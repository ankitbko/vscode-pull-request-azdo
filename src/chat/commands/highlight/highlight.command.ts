import { CancellationToken, ChatContext, ChatRequest, ChatResponseStream } from 'vscode';
import { PRType } from '../../../azdo/interface';
import Logger from '../../../common/logger';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import { IChatResult } from '../../core/chat.result';
import { PullRequestOverviewPanel } from '../../../azdo/pullRequestOverview';

/**
 * Automatically highlights the important parts of the currently reviewed pull request.
 * The highlights will post a comment placeholders for you to review.
 */
export default class implements IChatCommand {
	readonly name: string = 'highlight';

	public constructor(private readonly context: CommandContext) {}

	public async execute(
		request: ChatRequest,
		context: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken,
	): Promise<IChatResult> {
		const folderManagers = this.context.repositoriesManager.folderManagers;
		const allActivePrs = (await Promise.all(folderManagers.map(f => f.getPullRequests(PRType.AllActive)))).flatMap(t => t.items);
		const panel = PullRequestOverviewPanel.currentPanel;
		const pr = panel?.pullRequest;
		Logger.appendLine(`Chat > Highlight > allActivePrs: ${allActivePrs.length}`, this.name);

		// Active Pull Request (pull request raised from current branch): folderManagers[0].activePullRequest
		// Alternate way: folderManagers[0].azdoRepositories[0].getAllActivePullRequests()
		// PR on id: folderManagers[0].azdoRepositories[0].getPullRequest(1234)

		// Single PR specific functionalities
		// allActivePrs[0].getAllActiveThreadsBetweenAllIterations()
		// allActivePrs[0].getCommits()
		// File changes in PR: allActivePrs[0].getFileChangesInfo()
		// allActivePrs[0].getWorkItemRefs
		return {
			metadata: { command: 'foo' }
		};
	}
}
