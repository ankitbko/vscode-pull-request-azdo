import * as vscode from 'vscode';
import { IChatProvider } from './chat.provider';
import { IChatResult } from './core/chat.result';

export const createChatHandler = (chatProvider: IChatProvider): vscode.ChatRequestHandler => {
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
	): Promise<IChatResult> => {
		if (request.command) {
			const result = await chatProvider.getChatCommandByName(request.command)?.execute(request, context, stream, token);
			if (result) {
				return result;
			}
		}

		return { metadata: { command: '' } };
	};

	return handler;
};