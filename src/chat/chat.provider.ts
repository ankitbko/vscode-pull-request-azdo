import { ExtensionContext } from 'vscode';
import { RepositoriesManager } from '../azdo/repositoriesManager';
import { StateManager } from './chat.state';
import ExplainCommand from './commands/explain/explain.command';
import HighlightCommand from './commands/highlight/highlight.command';
import IChatCommand from './core/chat.command';

export interface IChatProvider {
	getChatCommandByName(commandName: string): IChatCommand;
}


export class ChatProvider implements IChatProvider {
	private readonly stateManager: StateManager;

	constructor(private readonly extensionContext: ExtensionContext, private readonly repositoriesManager: RepositoriesManager) {
		this.stateManager = new StateManager(extensionContext);
	}

	getChatCommandByName(commandName: string): IChatCommand {
		const commandContext = {
			extensionContext: this.extensionContext,
			stateManager: this.stateManager,
			repositoriesManager: this.repositoriesManager,
		};

		switch (commandName) {
			case 'highlight':
				return new HighlightCommand(commandContext);
			case 'explain':
				return new ExplainCommand(commandContext);
			default:
				throw new Error(`Command ${commandName} not found`);
		}
	}
}
