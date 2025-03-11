import * as vscode from 'vscode';
import { FolderRepositoryManager } from '../azdo/folderRepositoryManager';
import { IFileChangeNode } from '../azdo/interface';
import { PullRequestModel } from '../azdo/pullRequestModel';
import { CommonCommentHandler } from '../common/commonCommentHandler';

export class PullRequestCommentingRangeProvider implements vscode.CommentingRangeProvider {
	private _commonCommentHandler: CommonCommentHandler;

	constructor(
		private readonly pullRequestModel: PullRequestModel,
		private readonly _folderReposManager: FolderRepositoryManager,
		private readonly getFileChanges: () => Promise<IFileChangeNode[]>,
		private readonly fileChanges?: IFileChangeNode[] | undefined,
	) {
		this._commonCommentHandler = new CommonCommentHandler(pullRequestModel, _folderReposManager);
	}

	async provideCommentingRanges(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.Range[] | vscode.CommentingRanges> {
		return await this._commonCommentHandler.provideCommentingRanges(
			document,
			token,
			async () => await this.getFileChanges(),
			this.fileChanges,
		);
	}

}