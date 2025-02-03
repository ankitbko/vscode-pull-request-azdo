import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';

export interface PromptDefinition {
	model: vscode.LanguageModelChat;
	stream: vscode.ChatResponseStream;
	prompt: any;
	data: any;
}

const executePrompt = async (prompt: PromptDefinition, token: vscode.CancellationToken) => {
	const { messages } = await renderPrompt(
		prompt.prompt,
		prompt.data,
		{ modelMaxPromptTokens: prompt.model.maxInputTokens },
		prompt.model
	);
	const response = await prompt.model.sendRequest(messages, {}, token);

	let fullResponse = '';
	for await (const fragment of response.text) {
		prompt.stream.markdown(fragment);
		fullResponse += fragment;
	}

	return fullResponse;
};

export default executePrompt;
