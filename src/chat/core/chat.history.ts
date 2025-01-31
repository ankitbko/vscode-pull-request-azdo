

import * as vscode from 'vscode';

export const getPromptMessageHistory = (context: vscode.ChatContext) => {
	const previousMessages: vscode.LanguageModelChatMessage[] = context.history.flatMap(turn => {
		if (turn instanceof vscode.ChatRequestTurn) {
			return vscode.LanguageModelChatMessage.User(turn.prompt);
		} else {
			return turn.response.map(r => vscode.LanguageModelChatMessage.Assistant((r.value as vscode.MarkdownString).value));
		}
	});
	return previousMessages;
};
