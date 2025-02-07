import { ExtensionContext } from 'vscode';
import { RepositoriesManager } from '../azdo/repositoriesManager';
import { StateManager } from './chat.state';
import ExplainCommand from './commands/explain/explain.command';
import FeedCommand from './commands/feed/feed.command';
import HighlightCommand from './commands/highlight/highlight.command';
import ReviewCommand from './commands/review/review.command';
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
			case 'feed':
				return new FeedCommand(commandContext);
			case 'review':
				return new ReviewCommand(commandContext);
			default:
				throw new Error(`Command ${commandName} not found`);
		}
	}
}
