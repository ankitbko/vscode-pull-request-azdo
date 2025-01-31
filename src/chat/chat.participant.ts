import * as vscode from 'vscode';
import { createChatHandler } from './chat.handler';
import { IChatProvider } from './chat.provider';

export function registerChatParticipant(context: vscode.ExtensionContext, chatProvider: IChatProvider) {
		const chatParticipant = vscode.chat.createChatParticipant('vscode-pull-request-azdo', createChatHandler(chatProvider));
		chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'VSTS.svg');

		context.subscriptions.push(chatParticipant);
}
