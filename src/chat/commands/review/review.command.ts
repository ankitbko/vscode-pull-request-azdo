import * as path from 'path';
import { renderPrompt } from '@vscode/prompt-tsx';
import { VersionControlChangeType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import * as vscode from 'vscode';
import { IRawFileChange, LmReview, PRType } from '../../../azdo/interface';
import { PullRequestModel } from '../../../azdo/pullRequestModel';
import { removeLeadingSlash } from '../../../azdo/utils';
import { GitChangeType } from '../../../common/file';
import Logger from '../../../common/logger';
import { createUris, toPRUriAzdo, toReviewUri } from '../../../common/uri';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import { IChatResult } from '../../core/chat.result';
import ReviewPrompt, { ReviewPromptData } from './review.prompt';
import { getGitChangeTypeFromVersionControlChangeType } from '../../../common/diffHunk';
import { FolderRepositoryManager } from '../../../azdo/folderRepositoryManager';

/**
 * Automatically highlights the important parts of the currently reviewed pull request.
 * The highlights will post a comment placeholders for you to review.
 */
export default class implements IChatCommand {
	readonly name: string = 'review';

	public constructor(private readonly context: CommandContext) {}

	public async execute(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
	): Promise<IChatResult> {
		const prNumber = request.prompt;
		stream.progress('Fetching PR details...');
		const folderManagers = this.context.repositoriesManager.folderManagers;
		const pullRequestsResult = await Promise.all(folderManagers.map(f => {
			if (f.azdoRepositories.length === 0) {
				Logger.appendLine(`Chat > Review > PR Number: No azdoRepositories found for folder manager ${f.repository.rootUri.toString()}`);
				return null;
			}
			return f.azdoRepositories[0].getPullRequest(+prNumber);
		}));

		const pr = pullRequestsResult.filter(p => p !== null).pop();
		const folderManager = folderManagers.pop();
		if (!pr) {
			// TODO: Handle pr not found.
			return { metadata: { command: 'foo' } };
		}
		stream.markdown(`# Reviewing PR ${prNumber}: ${pr.item.title} \n`);
		stream.progress('Fetching files changed...');

		const fileChanges = await pr.getFileChangesInfo();

		stream.markdown(`There are ${fileChanges.length} files changed in this PR. \n`);
		const tree: vscode.ChatResponseFileTree[] = fileChanges.map(f => { return {name: removeLeadingSlash(f.filename)}; });
		stream.filetree(tree, folderManager.repository.rootUri);

		const allComments = [];
		for (const fileChange of fileChanges) {

			const { headUri, baseUri} = createUris(pr, folderManager, fileChange);

			stream.markdown(`## Reviewing file `);
			stream.anchor(vscode.Uri.file(folderManager.repository.rootUri.fsPath + fileChange.filename), 'Reviewing File');
			stream.progress(`Understanding changes...`);
			const diffHunk = await folderManager.repository.diffBetween(pr.base.sha, pr.head.sha, removeLeadingSlash(fileChange.filename));
			const response = await this.reviewFile(pr.item.title, pr.item.description, removeLeadingSlash(fileChange.filename), diffHunk, request.model, token);
			let fullResponse = '';
			for await (const fragment of response.text) {
				// stream.markdown(fragment);
				fullResponse += fragment;
			}
			const responseJson = this.parseResponseAsJson(fullResponse);
			stream.markdown(`${responseJson.description} \n`);
			stream.markdown('### Review Comments \n');
			if (responseJson.comments.length === 0) {
				stream.markdown('Everything looks good. No comments. \n');
			}
			for (const comment of responseJson.comments) {
				allComments.push(comment);
				stream.markdown(`- Line: ${comment.lineNumber}: ${comment.reviewComment} `);
				stream.button({ title: 'Add Comment', command: 'azdopr.lmAddReviewComment', arguments: [pr, folderManager, headUri, baseUri, fileChange, comment], tooltip: 'Add a comment to this line' });
				stream.markdown(`\n`);
			}
		}

		//workbench.action.addComment

		return {
			metadata: { command: 'foo' }
		};
	}

	private parseResponseAsJson(response: string): LmReview {
		const jsonStart = response.indexOf('```json');
		const jsonEnd = response.lastIndexOf('```');
		if (jsonStart !== -1 && jsonEnd !== -1) {
			response = response.substring(jsonStart + 7, jsonEnd).trim();
		}
		return JSON.parse(response);
	}

	public async reviewFile(title: string, description: string, fileName: string, diffHunk: string, model: vscode.LanguageModelChat, token: vscode.CancellationToken) {
		const data: ReviewPromptData = {
			prTitle: title,
			prDescription: description,
			fileName: fileName,
			diffHunk,
		};
		const { messages } = await renderPrompt(
			ReviewPrompt,
			data,
			{ modelMaxPromptTokens: model.maxInputTokens },
			model
		);
		const response = await model.sendRequest(messages, {}, token);
		return response;
	}
}


