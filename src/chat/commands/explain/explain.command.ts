import { CancellationToken, ChatContext, ChatRequest, ChatResponseStream } from 'vscode';
import executePrompt from '../../core/chat.prompt';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import { IChatResult } from '../../core/chat.result';
import ExplainPrompt, { ExplainPromptData } from './explain.prompt';

/**
 * Explains the changes made and the rationale of the currently active pull request.
 */
export default class implements IChatCommand {
	readonly name: string = 'explain';

	public constructor(private readonly context: CommandContext) {}

	public async execute(
		request: ChatRequest,
		context: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken, // todo: use it in executePrompt
	): Promise<IChatResult> {
		const data: ExplainPromptData = {
			description: request.prompt,
			changedFiles: ['file1', 'file2'],
			workItemDescriptions: ['wk1', 'wk2'],
		};

		await executePrompt({
			prompt: ExplainPrompt,
			previousMessages: [],
			data: data,
			model: request.model,
			stream,
		});

		return { metadata: { command: this.name } };
	}
}
