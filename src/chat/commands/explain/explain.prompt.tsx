import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';
import { ChatResponsePart } from '@vscode/prompt-tsx/dist/base/vscodeTypes';
import { GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { CancellationToken, ChatContext, ChatResponseFileTree, Progress } from 'vscode';
import { FolderRepositoryManager } from '../../../azdo/folderRepositoryManager';
import { PullRequestChecks } from '../../../azdo/interface';
import { PullRequestModel } from '../../../azdo/pullRequestModel';
import { removeLeadingSlash } from '../../../azdo/utils';
import { History } from '../../core/prompts/chat.history';
import FileContext, { IFilesToInclude } from '../../core/prompts/file.contents';

export interface ExplainPromptData extends BasePromptElementProps {
	history: ChatContext['history'];
	userQuery: string;
	referencedFiles: IFilesToInclude[];
	pr: PullRequestModel;
	folderManager: FolderRepositoryManager;
}

interface ExplainPromptState {
	checks: PullRequestChecks;
	threads: GitPullRequestCommentThread[];
	diffHunks: Diff[];
}

interface Diff {
	filename: string;
	diffHunk: string;
}

export default class ExplainPrompt extends PromptElement<ExplainPromptData, ExplainPromptState> {
	async prepare(
		sizing: PromptSizing,
		progress?: Progress<ChatResponsePart>,
		token?: CancellationToken,
	): Promise<ExplainPromptState> {
		const statusChecks = await this.props.pr.getStatusChecks();
		const allThreads = await this.props.pr.getAllActiveThreadsBetweenAllIterations();
		const fileChangesInfo = await this.props.pr.getFileChangesInfo();

		const diffHunks = await Promise.all(
			fileChangesInfo.map(async fileChange => {
				const diffHunk = await this.props.folderManager.repository.diffBetween(
					this.props.pr.base.sha,
					this.props.pr.head.sha,
					removeLeadingSlash(fileChange.filename),
				);
				return { filename: fileChange.filename, diffHunk };
			})
		);

		// TODO fetch work items
		// const workItems = await this.props.pr.getWorkItemRefs();

		return {
			checks: statusChecks,
			threads: allThreads ?? [],
			diffHunks: diffHunks,
		};
	}

	render(state: ExplainPromptState) {
		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					Act as an expert software engineer reviewing a pull request. Use the provided information effectively to
					deliver a truthful and cohesive summary of the changes.
					{/* <br />
					# Instructions
					<br />
					Your task is to provide a high-level summary of the changes made covering the following aspects:
					<br />
					- What is the current status of this pull request?
					<br />
					- Who is reviewing this PR?
					<br />
					- Why were the changes made?
					<br />
					- What is the design of the changes?
					<br />
					- What was discussed in the conversation threads so far?
					<br />
					- Is there any technical debt introduced?
					<br />- What are the risks associated with the changes? */}
				</UserMessage>
				<History history={this.props.history} passPriority older={0} newer={80} />
				<UserMessage priority={70}>{this.props.pr.item.description}</UserMessage>
				<UserMessage priority={60}>
					# Checks
					<br />
					## Overall status
					{state.checks.state}
					<br />
					## Individual statuses
					<br />
					{state.checks.statuses.map(x => `${x.description}: ${x.state}`).join('\n')}
				</UserMessage>
				<UserMessage priority={60}>
					# Reviewers:
					<br />
					{this.props.pr.item.reviewers?.map(x => x.displayName).join('\n')}
				</UserMessage>
				<UserMessage priority={50}>
					# Conversation threads:
					{state.threads.map(this._formatThread).join('\n')}
				</UserMessage>
				<UserMessage priority={40}>
					# Changes:
					{state.diffHunks.map(this._formatDiffHunk).join('\n')}
				</UserMessage>
				<UserMessage priority={90}>{this.props.userQuery}</UserMessage>
				<FileContext priority={80} flexGrow={1} files={this.props.referencedFiles} />
			</>
		);
	}

	private _formatDiffHunk(diff: Diff) {
		return `
			## ${diff.filename}
			${diff.diffHunk}
		`;
	}

	private _formatThread(thread: GitPullRequestCommentThread) {
		return `
		## ${thread.id}
		Last updated: ${thread.lastUpdatedDate?.toLocaleDateString()} - ${thread.comments?.length} comments
		Comments:
		${thread.comments?.map(x => `- ${x.author?.displayName}: ${x.content}`).join('\n')}
		`;
	}
}
