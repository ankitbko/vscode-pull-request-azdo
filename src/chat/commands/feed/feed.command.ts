import { CancellationToken, ChatContext, ChatRequest, ChatResponseStream, l10n } from 'vscode';
import { PRType } from '../../../azdo/interface';
import Logger from '../../../common/logger';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import executePrompt from '../../core/chat.prompt';
import { IChatResult } from '../../core/chat.result';
import FeedPrompt, { FeedPromptData } from './feed.prompt';

/**
 * Outlines the pull requests that may need your attention and the changes in them.
 */
export default class implements IChatCommand {
	readonly name: string = 'overview';

	public constructor(private readonly context: CommandContext) {}

	public async execute(
		request: ChatRequest,
		context: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken,
	): Promise<IChatResult> {
		const folderManagers = this.context.repositoriesManager.folderManagers;
		const allActivePrs = (await Promise.all(folderManagers.map(f => f.getPullRequests(PRType.AssignedToMe)))).flatMap(
			t => t.items,
		);
		Logger.appendLine(`Chat > Highlight > allActivePrs: ${allActivePrs.length}`, this.name);

		const data: FeedPromptData = {
			history: context.history,
			userQuery: request.prompt,
			pullRequests: allActivePrs.map(pr => ({
				id: pr.getPullRequestId(),
				title: pr.item.title ?? '',
				description: pr.item.description ?? '',
			})),
		};

		await executePrompt({
			prompt: FeedPrompt,
			data: data,
			model: request.model,
			stream,
		}, token);

		allActivePrs.forEach(pr => {
			stream.button({
				command: 'azdopr.openDescription',
				title: `See ${pr.getPullRequestId()}`,
				arguments: [pr],
			});
		});

		return {
			metadata: { command: 'foo' },
		};
	}
}
