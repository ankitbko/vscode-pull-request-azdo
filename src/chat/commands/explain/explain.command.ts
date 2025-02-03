import { CancellationToken, ChatContext, ChatRequest, ChatResponseStream, Uri } from 'vscode';
import { PRType } from '../../../azdo/interface';
import Logger from '../../../common/logger';
import IChatCommand, { CommandContext } from '../../core/chat.command';
import executePrompt from '../../core/chat.prompt';
import { resolveAllReferences } from '../../core/chat.references';
import { IChatResult } from '../../core/chat.result';
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
		const folderManagers = this.context.repositoriesManager.folderManagers;
		const pullRequestsResult = await Promise.all(folderManagers.map(f => f.getPullRequests(PRType.AllActive)));
		const allActivePrs = pullRequestsResult.flatMap(t => t.items);

		Logger.appendLine(`Chat > Explain > allActivePrs: ${allActivePrs.length}`, this.name);

		// Active Pull Request (pull request raised from current branch): folderManagers[0].activePullRequest
		// Alternate way: folderManagers[0].azdoRepositories[0].getAllActivePullRequests()
		// PR on id: folderManagers[0].azdoRepositories[0].getPullRequest(1234)



		// Single PR specific functionalities
		// allActivePrs[0].getAllActiveThreadsBetweenAllIterations()
		// allActivePrs[0].getCommits()
		// File changes in PR: allActivePrs[0].getFileChangesInfo()
		// allActivePrs[0].getWorkItemRefs

		const activeFileUri = (request.references.filter(x => x.modelDescription === "User's current visible code")[0].value as { uri: Uri }).uri;

		const activePrManager = this.context.repositoriesManager.getManagerForFile(activeFileUri);

		if (!activePrManager) {
			// We delta!
			return { metadata: { command: this.name } };
		}

		// TODO: This is never set, why? Is it set only if I have "local pull request branch set"? But somehow I cannot even select it (0 nodes under this tree root).
		const activePR = activePrManager.activePullRequest;

		const referencedTextFiles = await resolveAllReferences(request.references);

		const data: ExplainPromptData = {
			history: context.history,
			description: activePR?.item.description ?? '',
			userQuery: request.prompt,
			referencedFiles: referencedTextFiles,
			allFilesChanged: ['file1', 'file2'],
			referencedWorkItems: ['wk1', 'wk2'],
		};

		await executePrompt({
			prompt: ExplainPrompt,
			data: data,
			model: request.model,
			stream,
		}, token);

		return { metadata: { command: this.name } };
	}
}
