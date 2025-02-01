import * as vscode from 'vscode';

// TODO translate this into the existing domain language, or map into this
export interface PluginApi {
	getActivePullRequest(): PullRequest;
	getPullRequestsAssignedToMe(): PullRequest[];
}

export interface PullRequest {
	id: number;
	title: string;
	description: string;
	reviewers: Reviewer[];
	comments: Comment[];
	changeset: Changeset;
}

export interface Changeset {
	added: vscode.Uri[];
	removed: vscode.Uri[];
	modified: vscode.Uri[];
	renamed: vscode.Uri[];
}

export interface Reviewer {
	name: string;
	vsid: string;
}

export interface Comment {
// todo
}