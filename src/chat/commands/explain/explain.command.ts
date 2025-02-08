import {
	CancellationToken,
	ChatContext,
	ChatRequest,
	ChatResponseMarkdownPart,
	ChatResponseStream,
	ChatResponseTurn,
	LanguageModelChatMessage,
	Uri,
} from 'vscode';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import executePrompt from '../../core/chat.prompt';
import { resolveAllReferences } from '../../core/chat.references';
import { IChatResult } from '../../core/chat.result';
import { PRContext } from '../../core/prompts/pr.context';
import ExplainPrompt, { ExplainPromptData } from './explain.prompt';

/**
 * Explains the changes made and the rationale of the currently active pull request (the one that we are checked out at the moment).
 */
export default class implements IChatCommand {
	readonly name: string = 'explain';

	public constructor(private readonly context: CommandContext) {}

	public async execute(
		request: ChatRequest,
		context: ChatContext,
		stream: ChatResponseStream,
		token: CancellationToken, // todo: use it in executePrompt
	): Promise<IChatResult> {
		// Try find direct reference to a PR in the prompt
		const prContext = new PRContext(this.context);
		let pr = await prContext.getPR(request, context, stream, token);

		if (!pr) {
			// Try determining the PR from the user's visible code
			const userVisibleCodeReference = request.references.find(x => x.modelDescription === "User's current visible code");
			if (userVisibleCodeReference) {
				const activeFileUri = (userVisibleCodeReference.value as { uri: Uri }).uri;
				const activePrManager = this.context.repositoriesManager.getManagerForFile(activeFileUri);
				pr = activePrManager?.activePullRequest;
			}
		}

		if (!pr) {
			const response = new ChatResponseMarkdownPart(
				"I'm sorry, I couldn't find the pull request you are referring to. Please mention it like this: #12345",
			);
			stream.push(response);
			return { metadata: { command: this.name } };
		}

		const formattedDate = pr.item.creationDate?.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});


		const response = new ChatResponseMarkdownPart(
			`We're talking about the pull request '__${pr.item.title}__' (**[#${pr.getPullRequestId()}](${
				pr.url
			})**) raised by ${pr.item.createdBy?.displayName} on ${formattedDate}.`,
		);

		stream.push(response);

		// initialize the messages array with the prompt
		const messages = [LanguageModelChatMessage.User(request.prompt)];
		const previousMessages = context.history.filter(h => h instanceof ChatResponseTurn);

		// Active Pull Request (pull request raised from current branch): folderManagers[0].activePullRequest
		// Alternate way: folderManagers[0].azdoRepositories[0].getAllActivePullRequests()
		// PR on id: folderManagers[0].azdoRepositories[0].getPullRequest(1234)

		// Single PR specific functionalities
		// allActivePrs[0].getAllActiveThreadsBetweenAllIterations()
		// allActivePrs[0].getCommits()
		// File changes in PR: allActivePrs[0].getFileChangesInfo()
		// allActivePrs[0].getWorkItemRefs

		const referencedTextFiles = await resolveAllReferences(request.references);

		const data: ExplainPromptData = {
			history: context.history,
			pr: pr,
			userQuery: request.prompt,
			referencedFiles: referencedTextFiles
		};

		await executePrompt(
			{
				prompt: ExplainPrompt,
				data: data,
				model: request.model,
				stream,
			},
			token,
		);

		return { metadata: { command: this.name } };
	}
}
