import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';
import { CancellationToken, ChatContext, Progress } from 'vscode';
import { PullRequestModel } from '../../../azdo/pullRequestModel';
import { History } from '../../core/prompts/chat.history';
import FileContext, { IFilesToInclude } from '../../core/prompts/file.contents';
import { ChatResponsePart } from '@vscode/prompt-tsx/dist/base/vscodeTypes';
import { PullRequestChecks } from '../../../azdo/interface';
import { GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces';

export interface ExplainPromptData extends BasePromptElementProps {
	history: ChatContext['history'];
	userQuery: string;
	referencedFiles: IFilesToInclude[];
	pr: PullRequestModel;
}

interface ExplainPromptState {
	checks: PullRequestChecks
	threads: GitPullRequestCommentThread[]
}

export default class ExplainPrompt extends PromptElement<ExplainPromptData, ExplainPromptState> {
	async prepare(
		sizing: PromptSizing,
		progress?: Progress<ChatResponsePart>,
		token?: CancellationToken,
	): Promise<ExplainPromptState> {
		const statusChecks = await this.props.pr.getStatusChecks();
		const allThreads = await this.props.pr.getAllActiveThreadsBetweenAllIterations();

		// TODO fetch work items
		// const workItems = await this.props.pr.getWorkItemRefs();

		return {
			checks: statusChecks,
			threads: allThreads ?? []
		};
	}

	render(state: ExplainPromptState) {
		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					Imagine a scenario where you act like an expert software engineer helping review a pull request.
					<br />
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
					<br />- What are the risks associated with the changes?
				</UserMessage>
				<History history={this.props.history} passPriority older={0} newer={80} />
				<UserMessage priority={90}>{this.props.userQuery}</UserMessage>
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
				<FileContext priority={70} flexGrow={1} files={this.props.referencedFiles} />
			</>
		);
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
