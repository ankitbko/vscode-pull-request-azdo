import * as vscode from 'vscode';

export interface IChatResult extends vscode.ChatResult {
	metadata: {
		command: string;
	};
}
