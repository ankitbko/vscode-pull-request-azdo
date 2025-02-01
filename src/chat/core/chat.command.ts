import * as vscode from 'vscode';
import { RepositoriesManager } from '../../azdo/repositoriesManager';
import { StateManager } from '../chat.state';
import { IChatResult } from './chat.result';

export interface CommandContext {
	extensionContext: vscode.ExtensionContext;
	stateManager: StateManager;
	repositoriesManager: RepositoriesManager;
}

interface IChatCommand {
	name: string;
	execute(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
	): Promise<IChatResult>;
}

export default IChatCommand;