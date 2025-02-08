import * as vscode from 'vscode';
import { PullRequestModel } from '../../../azdo/pullRequestModel';
import { CommandContext } from '../chat.command';

const prompt = `
Determine what is the pull request ID the user referenced last.
Pull request IDs start with # and are followed by a number.
Answer with the pull request NUMBER VERBATIM.

# Examples

Ask: Tell me about #12345
Answer: 12345

Ask: #42123
Answer: 42123

Ask: PR 42881
Answer: 42881
`;

export class PRContext {
	constructor(private readonly context: CommandContext) {}

	public async getPR(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
	): Promise<PullRequestModel | undefined> {
		stream.progress('Resolving pull request...');
		const messages = [] as vscode.LanguageModelChatMessage[];
		const previousMessages = context.history.filter(h => h instanceof vscode.ChatResponseTurn);

		previousMessages.forEach(m => {
			let fullMessage = '';
			(m as vscode.ChatResponseTurn).response.forEach(r => {
				const mdPart = r as vscode.ChatResponseMarkdownPart;
				fullMessage += mdPart.value.value;
			});
			messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
		});

		messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
		messages.push(vscode.LanguageModelChatMessage.User(prompt));

		const chatResponse = await request.model.sendRequest(messages, {}, token);

		let response = '';
		for await (const fragment of chatResponse.text) {
			response += fragment;
		}

		let prNumber: number | null = null;
		if (response && !isNaN(Number(response))) {
			prNumber = parseInt(response, 10);
		}

		if (prNumber) {
			const folderManagers = this.context.repositoriesManager.folderManagers;
			const prPromises = folderManagers.flatMap(folderManager =>
				folderManager.azdoRepositories.map(repo => repo.getPullRequest(prNumber)),
			);

			const firstNonNullPR = await this._getFirstResolved(prPromises);

			if (firstNonNullPR) {
				stream.progress('Found it!');
				return firstNonNullPR;
			}
		}

		// const repoId = this.context.stateManager.getValue<string | null>('azdopr.lastReferencedRepo');
		// const prId = this.context.stateManager.getValue<string | null>('azdopr.lastReferencedPR');

		return undefined;
	}

	// There must be a more efficient way!
	private async _getFirstResolved<T>(promises: Promise<T | null>[]): Promise<T | null> {
		return new Promise<T | null>(resolve => {
			promises.forEach(promise => {
				promise
					.then(result => {
						if (result !== null) {
							resolve(result);
						}
					})
					.catch(() => {
						// Ignore errors
					});
			});
		});
	}
}
