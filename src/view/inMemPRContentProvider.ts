/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import { FolderRepositoryManager } from '../azdo/folderRepositoryManager';
import { IFileChangeNode } from '../azdo/interface';
import { PullRequestModel } from '../azdo/pullRequestModel';
import { GitChangeType } from '../common/file';
import Logger from '../common/logger';
import { fromPRUri, PRUriParams } from '../common/uri';

export class InMemPRContentProvider implements vscode.TextDocumentContentProvider {
	private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	get onDidChange(): vscode.Event<vscode.Uri> {
		return this._onDidChange.event;
	}

	fireDidChange(uri: vscode.Uri) {
		this._onDidChange.fire(uri);
	}

	private _prFileChangeContentProviders: { [key: number]: (uri: vscode.Uri) => Promise<string> } = {};

	constructor() {}

	async provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): Promise<string> {
		const prUriParams = fromPRUri(uri);
		if (prUriParams && prUriParams.prNumber) {
			const provider = this._prFileChangeContentProviders[prUriParams.prNumber];

			if (provider) {
				return await provider(uri);
			}
		}

		return '';
	}

	registerTextDocumentContentProvider(prNumber: number, provider: (uri: vscode.Uri) => Promise<string>): vscode.Disposable {
		this._prFileChangeContentProviders[prNumber] = provider;

		return {
			dispose: () => {
				delete this._prFileChangeContentProviders[prNumber];
			},
		};
	}
}

const inMemPRContentProvider = new InMemPRContentProvider();

export function getInMemPRContentProvider(): InMemPRContentProvider {
	return inMemPRContentProvider;
}

export async function provideDocumentContentForChangeModel(params: PRUriParams, pullRequestModel: PullRequestModel, folderReposManager: FolderRepositoryManager, fileChange: IFileChangeNode, isFileRemote: boolean): Promise<string> {
	if (
		(params.isBase && fileChange.status === GitChangeType.ADD) ||
		(!params.isBase && fileChange.status === GitChangeType.DELETE)
	) {
		return '';
	}

	if (isFileRemote) {
		try {
			return pullRequestModel.getFile(fileChange.sha!);
		} catch (e) {
			Logger.appendLine(`PR> Fetching file content failed: ${e}`);
			vscode.window
				.showWarningMessage(
					'Opening this file locally failed. Would you like to view it on AzDO?',
					'Open in AzDO',
				)
				.then(result => {
					if (result === 'Open in AzDO') {
						vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(fileChange.blobUrl));
					}
				});
			return '';
		}
	} else {
		if (fileChange.status === GitChangeType.ADD) {
			const originalFileName = fileChange.fileName;
			const originalFilePath = vscode.Uri.joinPath(folderReposManager.repository.rootUri, originalFileName!);
			const commit = params.headCommit;
			const originalContent = await folderReposManager.repository.show(commit, originalFilePath.fsPath);
			return originalContent;
		} else if (fileChange.status === GitChangeType.RENAME) {
			let commit = params.baseCommit;
			let originalFileName = fileChange.previousFileName;
			if (!params.isBase) {
				commit = params.headCommit;
				originalFileName = fileChange.fileName;
			}

			const originalFilePath = vscode.Uri.joinPath(folderReposManager.repository.rootUri, originalFileName!);
			const originalContent = await folderReposManager.repository.show(commit, originalFilePath.fsPath);
			return originalContent;
		} else {
			const originalFileName =
				fileChange.status === GitChangeType.DELETE ? fileChange.previousFileName : fileChange.fileName;
			const originalFilePath = vscode.Uri.joinPath(folderReposManager.repository.rootUri, originalFileName!);
			let commit = params.baseCommit;
			if (!params.isBase) {
				commit = params.headCommit;
			}
			const originalContent = await folderReposManager.repository.show(commit, originalFilePath.fsPath);
			return originalContent;
			// if (params.isBase) {
			// 	return originalContent;
			// } else {
			// 	return getModifiedContentFromDiffHunkAzdo(originalContent, fileChange.diffHunks);
			// }
		}
	}

	return '';
}