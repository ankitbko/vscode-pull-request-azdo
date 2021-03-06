/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GitApiImpl } from '../api/api1';
import { RepositoriesManager } from '../azdo/repositoriesManager';
import { ITelemetry } from '../common/telemetry';
import { URI_SCHEME_REVIEW } from '../constants';
import { GitContentProvider } from './gitContentProvider';
import { PullRequestChangesTreeDataProvider } from './prChangesTreeDataProvider';
import { PullRequestsTreeDataProvider } from './prsTreeDataProvider';
import { ReviewManager } from './reviewManager';

export class ReviewsManager {
	public static ID = 'Reviews';
	private _disposables: vscode.Disposable[];

	constructor(
		private _context: vscode.ExtensionContext,
		private _reposManager: RepositoriesManager,
		private _reviewManagers: ReviewManager[],
		private _prsTreeDataProvider: PullRequestsTreeDataProvider,
		private _prFileChangesProvider: PullRequestChangesTreeDataProvider,
		private _telemetry: ITelemetry,
		gitApi: GitApiImpl,
	) {
		this._disposables = [];
		const gitContentProvider = new GitContentProvider(gitApi);
		gitContentProvider.registerTextDocumentContentFallback(this.provideTextDocumentContent.bind(this));
		this._disposables.push(vscode.workspace.registerTextDocumentContentProvider(URI_SCHEME_REVIEW, gitContentProvider));
		this.registerListeners();
		this._disposables.push(this._prsTreeDataProvider);
	}

	private registerListeners(): void {
		this._disposables.push(
			vscode.workspace.onDidChangeConfiguration(async e => {
				if (e.affectsConfiguration('githubPullRequests.showInSCM')) {
					if (this._prFileChangesProvider) {
						this._prFileChangesProvider.dispose();
						this._prFileChangesProvider = new PullRequestChangesTreeDataProvider(this._context);

						for (const reviewManager of this._reviewManagers) {
							reviewManager.updateState();
						}
					}

					this._prsTreeDataProvider.dispose();
					this._prsTreeDataProvider = new PullRequestsTreeDataProvider(this._telemetry);
					this._prsTreeDataProvider.initialize(this._reposManager);
					this._disposables.push(this._prsTreeDataProvider);
				}
			}),
		);
	}

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {
		for (const reviewManager of this._reviewManagers) {
			if (uri.fsPath.startsWith(reviewManager.repository.rootUri.fsPath)) {
				return reviewManager.provideTextDocumentContent(uri);
			}
		}
		return '';
	}

	dispose() {
		this._disposables.forEach(d => {
			d.dispose();
		});
	}
}
