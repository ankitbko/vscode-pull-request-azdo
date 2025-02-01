import * as vscode from 'vscode';
import { StateManager } from '../chat.state';
import { PluginApi } from '../plugin.api';
import { IChatResult } from './chat.result';

export interface CommandContext {
	extensionContext: vscode.ExtensionContext;
	stateManager: StateManager;
	pluginApi: PluginApi;
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