/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Comment,
	GitPullRequest,
	GitPullRequestMergeStrategy,
	GitStatusState,
	VersionControlChangeType,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { Uri } from 'vscode';
import { DiffHunk } from '../common/diffHunk';
import { GitChangeType } from '../common/file';

export enum PRType {
	Query,
	AllActive,
	LocalPullRequest,
	CreatedByMe,
	AssignedToMe,
}

export enum ReviewEvent {
	Approve = 'APPROVE',
	RequestChanges = 'REQUEST_CHANGES',
	Comment = 'COMMENT',
}

export enum GithubItemStateEnum {
	Open,
	Merged,
	Closed,
}

export enum PullRequestMergeability {
	NotSet = 0,
	/**
	 * Pull request merge is queued.
	 */
	Queued = 1,
	/**
	 * Pull request merge failed due to conflicts.
	 */
	Conflicts = 2,
	/**
	 * Pull request merge succeeded.
	 */
	Succeeded = 3,
	/**
	 * Pull request merge rejected by policy.
	 */
	RejectedByPolicy = 4,
	/**
	 * Pull request merge failed.
	 */
	Failure = 5,
}

export interface ReviewState {
	reviewer: IAccount;
	state: PullRequestVote;
	isRequired: boolean;
}

export interface IAccount {
	id?: string;
	name?: string;
	avatarUrl?: string;
	url?: string;
	email?: string;
}

export interface ISuggestedReviewer extends IAccount {
	isAuthor: boolean;
	isCommenter: boolean;
}

export interface IMilestone {
	title: string;
	dueOn?: string | null;
	createdAt: string;
	id: string;
}

export interface MergePullRequest {
	sha: string;
	merged: boolean;
	message: string;
	documentation_url: string;
}

export interface IRepository {
	cloneUrl: string;
}

export interface IGitHubRef {
	ref: string;
	sha: string;
	repo: IRepository;
	exists?: boolean;
}

export interface ILabel {
	name: string;
	color: string;
}

export interface Issue {
	id?: number;
	number?: number;
	url?: string;
	state?: string;
	body?: string;
	bodyHTML?: string;
	title?: string;
	assignees?: IAccount[];
	createdAt?: string;
	user?: IAccount;
	labels?: ILabel[];
	milestone?: IMilestone;
	repositoryOwner?: string;
	repositoryName?: string;
	repositoryUrl?: string;
	comments?: {
		author: IAccount;
		body: string;
		databaseId: number;
	}[];
}

export enum PullRequestVote {
	NO_VOTE = 0,
	WAITING_FOR_AUTHOR = -5,
	REJECTED = -10,
	APPROVED_WITH_SUGGESTION = 5,
	APPROVED = 10,
}

export interface PullRequest extends GitPullRequest {
	head?: IGitHubRef;
	base?: IGitHubRef;
	merged?: boolean;
}

export interface IRawFileChange {
	file_sha?: string;
	previous_file_sha?: string;
	filename: string;
	previous_filename?: string;
	status: VersionControlChangeType;
	raw_url: string;
	blob_url: string;
	patch?: string;
	diffHunks?: DiffHunk[];
}


export interface IFileChangeNode {
	status: GitChangeType;
	sha?: string;
	blobUrl: string;
	fileName: string;
	previousFileName: string;
	diffHunks?: DiffHunk[];
}

export interface IFileChangeNodeWithUri extends IFileChangeNode {
	filePath: Uri;
	parentFilePath: Uri;
}


export interface IPullRequestsPagingOptions {
	fetchNextPage: boolean;
}

export interface IPullRequestEditData {
	body?: string;
	title?: string;
}

export type MergeMethod = 'Squash' | 'NoFastForward' | 'Rebase' | 'RebaseMerge';

export type MergeMethodsAvailability = {
	[method in MergeMethod]: boolean;
};

export type RepoAccessAndMergeMethods = {
	hasWritePermission: boolean;
	mergeMethodsAvailability: MergeMethodsAvailability;
};

export interface User extends IAccount {
	company?: string;
	location?: string;
	bio?: string;
	commitContributions: {
		createdAt: Date;
		repoNameWithOwner: string;
	}[];
}

export interface PullRequestChecks {
	state: GitStatusState;
	statuses: {
		id: string;
		url?: string;
		avatar_url?: string;
		state?: GitStatusState;
		description?: string;
		target_url?: string;
		context: string;
		genre?: string;
	}[];
}

export interface CommentPermissions {
	canEdit: boolean;
	canDelete: boolean;
}

export interface CommentWithPermissions {
	comment: Comment;
	commentPermissions: CommentPermissions;
}

export interface PullRequestCompletion {
	deleteSourceBranch: boolean;
	mergeStrategy: GitPullRequestMergeStrategy;
	transitionWorkItems: boolean;
}

export enum DiffBaseConfig {
	head = 'head',
	mergeBase = 'mergebase',
}

export interface LmReviewComment {
	lineNumber: number;
	reviewComment: string;
}

export interface LmReview {
	comments: LmReviewComment[];
	description: string;
}