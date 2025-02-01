import * as vscode from 'vscode';
import { IChatProvider } from './chat.provider';
import { getPromptMessageHistory } from './core/chat.history';
import { IChatResult } from './core/chat.result';

export const createChatHandler = (chatProvider: IChatProvider): vscode.ChatRequestHandler => {
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
	): Promise<IChatResult> => {
		// TODO: catch and handle vscode.LanguageModelError (off topic and so on)
		const result = await chatProvider.getChatCommandByName(request.command)?.execute(request, context, stream, token);
		if (result) {
			return result;
		}

		const previousMessages = getPromptMessageHistory(context);
		const chatResponse = await request.model.sendRequest(
			[...previousMessages, vscode.LanguageModelChatMessage.User(request.prompt)],
			{},
			token,
		);
		for await (const fragment of chatResponse.text) {
			stream.markdown(fragment);
		}

		return { metadata: { command: '' } };
	};

	return handler;
};