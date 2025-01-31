import { CancellationToken, ChatContext, ChatRequest, ChatResponseStream } from 'vscode';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import { IChatResult } from '../../core/chat.result';

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
		throw new Error('Method not implemented.');
	}
}
