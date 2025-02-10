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
		const [statusChecks, allThreads, fileChangesInfo] = await Promise.all([
			this.props.pr.getStatusChecks(),
			this.props.pr.getAllActiveThreadsBetweenAllIterations(),
			this.props.pr.getFileChangesInfo()
		]);

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
					Act as an expert software engineer who meticulously reviews code changes, prioritizing:
					<br />
					1. Rationale: Why is a change necessary? What is the cost of not making this change now?
					<br />
					2. Safety: can a change be safely deployed to production? E.g. is there enough test coverage? Are there
					correctly implemented feature flags?
					<br />
					3. Design & quality: does the code meet best industry practices? For example, are the right design patterns
					used if applicable? Is the codebase easily testable?
					<br />
					4. Maintainability: what does a change mean for the future of the codebase? You are not know-it-all and you
					are not expected to know everything. If you are unsure about something, speculate and ask questions.
					<br />
					# Instructions
					<br />
					Take a deep breath and carefully read all information presented to you to deeply understand the changes. Pay
					special attention to the description of the pull request and comments already made by others. Then, provide
					comprehensive feedback in compliance with your excellent code review methodology.
				</UserMessage>
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
				{state.diffHunks.map(x => (
					<UserMessage priority={40}>
						Change:
						<br />
						{this._formatDiffHunk(x)}
					</UserMessage>
				))}
				<History history={this.props.history} passPriority older={0} newer={80} />
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
