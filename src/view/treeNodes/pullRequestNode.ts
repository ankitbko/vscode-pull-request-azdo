/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Comment, GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces';
import * as vscode from 'vscode';
import { FolderRepositoryManager } from '../../azdo/folderRepositoryManager';
import { CommentPermissions, CommentWithPermissions, IFileChangeNode } from '../../azdo/interface';
import { PullRequestModel } from '../../azdo/pullRequestModel';
import { getPositionFromThread, removeLeadingSlash } from '../../azdo/utils';
import { mapThreadsToBase } from '../../common/commentingRanges';
import { getZeroBased } from '../../common/diffPositionMapping';
import { GitChangeType, SlimFileChange } from '../../common/file';
import Logger from '../../common/logger';
import { fromPRUri, toPRUriAzdo } from '../../common/uri';
import { SETTINGS_NAMESPACE } from '../../constants';
import { getInMemPRContentProvider, provideDocumentContentForChangeModel } from '../inMemPRContentProvider';
import { PullRequestCommentingRangeProvider } from '../pullRequestCommentingRangeProvider';
import { DescriptionNode } from './descriptionNode';
import { DirectoryTreeNode } from './directoryTreeNode';
import { GitFileChangeNode, InMemFileChangeNode, RemoteFileChangeNode } from './fileChangeNode';
import { TreeNode, TreeNodeParent } from './treeNode';

/**
 * Thread data is raw data. It should be transformed to GHPRCommentThreads
 * before being sent to VSCode.
 */
export interface ThreadData {
	threadId: number;
	uri: vscode.Uri;
	range: vscode.Range;
	comments: CommentWithPermissions[];
	collapsibleState: vscode.CommentThreadCollapsibleState;
	rawThread: GitPullRequestCommentThread;
}

export function getDocumentThreadDatas(
	uri: vscode.Uri,
	isBase: boolean,
	fileChange: RemoteFileChangeNode | InMemFileChangeNode | GitFileChangeNode,
	matchingComments: GitPullRequestCommentThread[],
	getCommentPermission: (comment: Comment) => CommentPermissions,
): ThreadData[] {
	if (!fileChange || fileChange instanceof RemoteFileChangeNode) {
		return [];
	}

	const threads: ThreadData[] = [];

	const commentsPerBase = mapThreadsToBase(matchingComments, isBase);

	for (const azdoThread of commentsPerBase) {
		const commentAbsolutePosition = getPositionFromThread(azdoThread);

		if (!commentAbsolutePosition || commentAbsolutePosition < 0) {
			continue;
		}

		const pos = new vscode.Position(getZeroBased(commentAbsolutePosition), 0);
		const range = new vscode.Range(pos, pos);

		threads.push({
			threadId: azdoThread.id!,
			uri: uri,
			range,
			comments:
				azdoThread.comments?.map(c => {
					return { comment: c, commentPermissions: getCommentPermission(c) };
				}) ?? [],
			collapsibleState: vscode.CommentThreadCollapsibleState.Expanded,
			rawThread: azdoThread,
		});
	}

	return threads;
}

export class PRNode extends TreeNode {
	static ID = 'PRNode';

	private _fileChanges: (RemoteFileChangeNode | InMemFileChangeNode)[] | undefined;
	private _commentController?: vscode.CommentController;

	private _disposables: vscode.Disposable[] = [];

	private _inMemPRContentProvider?: vscode.Disposable;

	private _command: vscode.Command;
	public commentingRangeProvider: vscode.CommentingRangeProvider;

	public get command(): vscode.Command {
		return this._command;
	}

	public set command(newCommand: vscode.Command) {
		this._command = newCommand;
	}

	constructor(
		public parent: TreeNodeParent,
		private _folderReposManager: FolderRepositoryManager,
		public pullRequestModel: PullRequestModel,
		private _isLocal: boolean,
	) {
		super();
		this.commentingRangeProvider = new PullRequestCommentingRangeProvider(pullRequestModel, _folderReposManager, async () => await this.getFileChanges());
	}

	// #region Tree
	async getChildren(): Promise<TreeNode[]> {
		Logger.debug(`Fetch children of PRNode #${this.pullRequestModel.getPullRequestId()}`, PRNode.ID);
		try {
			if (this.childrenDisposables && this.childrenDisposables.length) {
				this.childrenDisposables.forEach(dp => dp.dispose());
			}

			const descriptionNode = new DescriptionNode(
				this,
				'Description',
				new vscode.ThemeIcon('git-pull-request'),
				this.pullRequestModel,
			);

			if (!this.pullRequestModel.isResolved()) {
				return [descriptionNode];
			}

			this._fileChanges = await this.resolveFileChanges();
			await this.pullRequestModel.getPullRequestFileViewState();

			if (!this._inMemPRContentProvider) {
				this._inMemPRContentProvider = getInMemPRContentProvider().registerTextDocumentContentProvider(
					this.pullRequestModel.getPullRequestId(),
					this.provideDocumentContent.bind(this),
				);
			}

			// The review manager will register a document comment's controller, so the node does not need to
			if (!this.pullRequestModel.equals(this._folderReposManager.activePullRequest)) {
				if (!this._commentController) {
					await this.resolvePRCommentController();
				}

				// await this.refreshExistingPREditors(vscode.window.visibleTextEditors, true);
				//await this.pullRequestModel.validateDraftMode();
				// await this.refreshContextKey(vscode.window.activeTextEditor);
			} else {
				// await this.pullRequestModel.azdoRepository.ensureCommentsController();
				// this.pullRequestModel.azdoRepository.commentsHandler!.clearCommentThreadCache(
				// 	this.pullRequestModel.getPullRequestId(),
				// );
			}

			const result: TreeNode[] = [descriptionNode];
			const layout = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string>('fileListLayout');
			if (layout === 'tree') {
				// tree view
				const dirNode = new DirectoryTreeNode(this, '');
				this._fileChanges.forEach(f => dirNode.addFile(f));
				dirNode.finalize();
				if (dirNode.label === '') {
					// nothing on the root changed, pull children to parent
					result.push(...dirNode.children);
				} else {
					result.push(dirNode);
				}
			} else {
				// flat view
				result.push(...this._fileChanges);
			}

			this.childrenDisposables = result;
			return result;
		} catch (e) {
			Logger.appendLine(e);
			return [];
		}
	}

	private async resolvePRCommentController(): Promise<void> {
		await this.pullRequestModel.azdoRepository.ensureCommentsController();
		this._commentController = this.pullRequestModel.azdoRepository.commentsController!;

		this._disposables.push(
			this.pullRequestModel.azdoRepository.commentsHandler!.registerCommentingRangeProvider(
				this.pullRequestModel.getPullRequestId(),
				this.commentingRangeProvider,
			),
		);

		this._disposables.push(
			this.pullRequestModel.azdoRepository.commentsHandler!.registerCommentController(
				this.pullRequestModel.getPullRequestId(),
				this.pullRequestModel,
				this._folderReposManager,
				async () => await this.getFileChanges(),
			),
		);

		this.registerListeners();
	}

	private registerListeners(): void {}

	private async getFileChanges(): Promise<(RemoteFileChangeNode | InMemFileChangeNode)[]> {
		if (!this._fileChanges) {
			this._fileChanges = await this.resolveFileChanges();
		}

		return this._fileChanges;
	}

	private async resolveFileChanges(): Promise<(RemoteFileChangeNode | InMemFileChangeNode)[]> {
		const rawChanges = await this.pullRequestModel.getFileDiffChanges(this._folderReposManager.repository);
		if (rawChanges.length === 0) {
			return [];
		}

		const comments = (await this.pullRequestModel.getAllActiveThreadsBetweenAllIterations()) ?? [];

		return rawChanges.map(change => {
			const headCommit = this.pullRequestModel.head!.sha;
			let fileName = change.fileName;
			let parentFileName = change.previousFileName!;
			let sha = change.fileSHA;

			if (change.status === GitChangeType.DELETE) {
				fileName = change.previousFileName!; // filename is empty. Used as "label" in treenode
				parentFileName = change.previousFileName!;
				sha = change.previousFileSHA;
			}

			if (change instanceof SlimFileChange) {
				return new RemoteFileChangeNode(
					this,
					this.pullRequestModel,
					change.status,
					fileName,
					change.previousFileName,
					change.blobUrl,
					toPRUriAzdo(
						vscode.Uri.file(
							path.resolve(this._folderReposManager.repository.rootUri.fsPath, removeLeadingSlash(fileName)),
						),
						this.pullRequestModel,
						change.baseCommit,
						headCommit,
						fileName,
						false,
						change.status,
					),
					toPRUriAzdo(
						vscode.Uri.file(
							path.resolve(
								this._folderReposManager.repository.rootUri.fsPath,
								removeLeadingSlash(parentFileName),
							),
						),
						this.pullRequestModel,
						change.baseCommit,
						headCommit,
						parentFileName,
						true,
						change.status,
					),
					sha,
				);
			}

			const changedItem = new InMemFileChangeNode(
				this,
				this.pullRequestModel,
				change.status,
				fileName,
				change.previousFileName,
				change.blobUrl,
				toPRUriAzdo(
					vscode.Uri.file(
						path.resolve(this._folderReposManager.repository.rootUri.fsPath, removeLeadingSlash(fileName)),
					),
					this.pullRequestModel,
					change.baseCommit,
					headCommit,
					fileName,
					false,
					change.status,
				),
				toPRUriAzdo(
					vscode.Uri.file(
						path.resolve(this._folderReposManager.repository.rootUri.fsPath, removeLeadingSlash(parentFileName)),
					),
					this.pullRequestModel,
					change.baseCommit,
					headCommit,
					parentFileName,
					true,
					change.status,
				),
				change.isPartial,
				change.patch,
				change.diffHunks,
				comments.filter(comment => comment.threadContext?.filePath === fileName && !!getPositionFromThread(comment)),
				sha,
			);

			return changedItem;
		});
	}

	getTreeItem(): vscode.TreeItem {
		const currentBranchIsForThisPR = this.pullRequestModel.equals(this._folderReposManager.activePullRequest);

		const { isDraft } = this.pullRequestModel;
		const title = this.pullRequestModel.item.title;
		const number = this.pullRequestModel.getPullRequestId();
		const html_url = this.pullRequestModel.url;
		const login = this.pullRequestModel.item.createdBy?.uniqueName;

		const labelPrefix = currentBranchIsForThisPR ? '✓ ' : '';
		const tooltipPrefix = currentBranchIsForThisPR ? 'Current Branch * ' : '';
		const formattedPRNumber = number.toString();
		const label = `${labelPrefix}#${formattedPRNumber}: ${isDraft ? '[DRAFT] ' : ''}${title}`;
		const tooltip = `${tooltipPrefix}${title} by ${login}`;
		const description = `#${formattedPRNumber} by ${login}`;

		return {
			label,
			id: `${this.parent instanceof TreeNode ? this.parent.label : ''}${html_url}`, // unique id stable across checkout status
			tooltip,
			description,
			collapsibleState: 1,
			contextValue:
				'pullrequest' + (this._isLocal ? ':local' : '') + (currentBranchIsForThisPR ? ':active' : ':nonactive'),
			iconPath: this.pullRequestModel.item.createdBy?.imageUrl
				? this.pullRequestModel.item.createdBy?.imageUrl
				: new vscode.ThemeIcon('github'),
		};
	}

	// #endregion

	// #region Document Content Provider
	private async provideDocumentContent(uri: vscode.Uri): Promise<string> {
		const params = fromPRUri(uri);
		if (!params) {
			return '';
		}

		const allFileChanges = await this.getFileChanges();
		const fileChange = allFileChanges.find(contentChange => contentChange.fileName === params.fileName);
		if (!fileChange) {
			Logger.appendLine(`PR> can not find content for document ${uri.toString()}`);
			return '';
		}

		const isFileRemote = fileChange instanceof RemoteFileChangeNode || fileChange.isPartial;

		return provideDocumentContentForChangeModel(params, this.pullRequestModel, this._folderReposManager, fileChange as IFileChangeNode, isFileRemote);
	}

	// #endregion

	dispose(): void {
		super.dispose();

		if (this._inMemPRContentProvider) {
			this._inMemPRContentProvider.dispose();
		}

		this._commentController = undefined;

		this._disposables.forEach(d => d.dispose());
	}
}
