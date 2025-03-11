/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRawFileChange } from '../azdo/interface';
import { DiffHunk } from './diffHunk';

export enum GitChangeType {
	ADD,
	COPY,
	DELETE,
	MODIFY,
	RENAME,
	TYPE,
	UNKNOWN,
	UNMERGED,
}

export class InMemFileChange {
	constructor(
		public readonly baseCommit: string,
		public readonly headCommit: string,
		public readonly status: GitChangeType,
		public readonly fileName: string,
		public readonly previousFileName: string | undefined,
		public readonly patch: string,
		public readonly diffHunks: DiffHunk[],

		public readonly isPartial: boolean,
		public readonly blobUrl: string,
		public readonly fileSHA?: string,
		public readonly previousFileSHA?: string,
	) {}
}

export class SlimFileChange {
	constructor(
		public readonly baseCommit: string,
		public readonly headCommit: string,
		public readonly blobUrl: string,
		public readonly status: GitChangeType,
		public readonly fileName: string,
		public readonly previousFileName: string | undefined,
		public readonly fileSHA?: string,
		public readonly previousFileSHA?: string,
	) {}
}
