import * as vscode from 'vscode';
import { PullRequestModel } from '../../../azdo/pullRequestModel';
import { CommandContext } from '../chat.command';

const prompt = `

`;

export class PRContext {
	constructor(private readonly context: CommandContext) {}

	public async getPR(request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<PullRequestModel | null> {
			const messages = [vscode.LanguageModelChatMessage.User(prompt)];
			const previousMessages = context.history.filter(h => h instanceof vscode.ChatResponseTurn);

			previousMessages.forEach(m => {
				let fullMessage = '';
				m.response.forEach(r => {
					const mdPart = r as vscode.ChatResponseMarkdownPart;
					fullMessage += mdPart.value.value;
				});
				messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
			});

			messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

			const chatResponse = await request.model.sendRequest(messages, {}, token);

			let response = '';
			for await (const fragment of chatResponse.text) {
				response += fragment;
			}

			let prNumber: number | null = null;
			if (response && !isNaN(Number(response))) {
				prNumber = parseInt(response, 10);
			}

			if (prNumber) {
				return null;
			}

			return null;
	}

}
