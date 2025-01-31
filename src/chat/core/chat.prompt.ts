import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';

export interface PromptDefinition {
	model: vscode.LanguageModelChat;
	stream: vscode.ChatResponseStream;
	previousMessages: vscode.LanguageModelChatMessage[];
	prompt: any;
	data: any;
}

const executePrompt = async (prompt: PromptDefinition) => {
	const { messages } = await renderPrompt(
		prompt.prompt,
		prompt.data,
		{ modelMaxPromptTokens: prompt.model.maxInputTokens },
		prompt.model
	);
	const allMessages = [...prompt.previousMessages, ...messages];
	const response = await prompt.model.sendRequest(allMessages, {});

	let fullResponse = '';
	for await (const fragment of response.text) {
		prompt.stream.markdown(fragment);
		fullResponse += fragment;
	}

	return fullResponse;
};

export default executePrompt;
