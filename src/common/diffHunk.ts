/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Inspired by and includes code from GitHub/VisualStudio project, obtained from  https://github.com/github/VisualStudio/blob/master/src/GitHub.Exports/Models/DiffLine.cs
 */

import { VersionControlChangeType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { Repository } from '../api/api';
import { IRawFileChange as IAzdoRawFileChange } from '../azdo/interface';
import { removeLeadingSlash } from '../azdo/utils';
import { GitChangeType, InMemFileChange, SlimFileChange } from './file';

export enum DiffChangeType {
	Context,
	Add,
	Delete,
	Control,
}

export class DiffLine {
	public get raw(): string {
		return this._raw;
	}

	public get text(): string {
		return this._raw.substr(1);
	}

	constructor(
		public type: DiffChangeType,
		public oldLineNumber: number /* 1 based */,
		public newLineNumber: number /* 1 based */,
		public positionInHunk: number,
		private _raw: string = '',
		public endwithLineBreak: boolean = true,
	) {}
}

export function getDiffChangeType(text: string) {
	const c = text[0];
	switch (c) {
		case ' ':
			return DiffChangeType.Context;
		case '+':
			return DiffChangeType.Add;
		case '-':
			return DiffChangeType.Delete;
		default:
			return DiffChangeType.Control;
	}
}

export class DiffHunk {
	public diffLines: DiffLine[] = [];

	constructor(
		public oldLineNumber: number,
		public oldLength: number,
		public newLineNumber: number,
		public newLength: number,
		public positionInHunk: number,
	) {}
}

export const DIFF_HUNK_HEADER = /^@@ \-(\d+)(,(\d+))?( \+(\d+)(,(\d+)?)?)? @@/;

export function countCarriageReturns(text: string): number {
	let count = 0;
	let index = 0;
	while ((index = text.indexOf('\r', index)) !== -1) {
		index++;
		count++;
	}

	return count;
}

export function* LineReader(text: string): IterableIterator<string> {
	let index = 0;

	while (index !== -1 && index < text.length) {
		const startIndex = index;
		index = text.indexOf('\n', index);
		const endIndex = index !== -1 ? index : text.length;
		let length = endIndex - startIndex;

		if (index !== -1) {
			if (index > 0 && text[index - 1] === '\r') {
				length--;
			}

			index++;
		}

		yield text.substr(startIndex, length);
	}
}

export function* parseDiffHunk(diffHunkPatch: string): IterableIterator<DiffHunk> {
	const lineReader = LineReader(diffHunkPatch);

	let itr = lineReader.next();
	let diffHunk: DiffHunk | undefined = undefined;
	let positionInHunk = -1;
	let oldLine = -1;
	let newLine = -1;

	while (!itr.done) {
		const line = itr.value;
		if (DIFF_HUNK_HEADER.test(line)) {
			if (diffHunk) {
				yield diffHunk;
				diffHunk = undefined;
			}

			if (positionInHunk === -1) {
				positionInHunk = 0;
			}

			const matches = DIFF_HUNK_HEADER.exec(line);
			const oriStartLine = (oldLine = Number(matches![1]));
			// http://www.gnu.org/software/diffutils/manual/diffutils.html#Detailed-Unified
			// `count` is added when the changes have more than 1 line.
			const oriLen = Number(matches![3]) || 1;
			const newStartLine = (newLine = Number(matches![5]));
			const newLen = Number(matches![7]) || 1;

			diffHunk = new DiffHunk(oriStartLine, oriLen, newStartLine, newLen, positionInHunk);
			// @rebornix todo, once we have enough tests, this should be removed.
			diffHunk.diffLines.push(new DiffLine(DiffChangeType.Control, -1, -1, positionInHunk, line));
		} else if (diffHunk) {
			const type = getDiffChangeType(line);

			if (type === DiffChangeType.Control) {
				if (diffHunk.diffLines && diffHunk.diffLines.length) {
					diffHunk.diffLines[diffHunk.diffLines.length - 1].endwithLineBreak = false;
				}
			} else {
				diffHunk.diffLines.push(
					new DiffLine(
						type,
						type !== DiffChangeType.Add ? oldLine : -1,
						type !== DiffChangeType.Delete ? newLine : -1,
						positionInHunk,
						line,
					),
				);

				const lineCount = 1 + countCarriageReturns(line);

				switch (type) {
					case DiffChangeType.Context:
						oldLine += lineCount;
						newLine += lineCount;
						break;
					case DiffChangeType.Delete:
						oldLine += lineCount;
						break;
					case DiffChangeType.Add:
						newLine += lineCount;
						break;
				}
			}
		}

		if (positionInHunk !== -1) {
			++positionInHunk;
		}
		itr = lineReader.next();
	}

	if (diffHunk) {
		yield diffHunk;
	}
}

export function parsePatch(patch: string): DiffHunk[] {
	const diffHunkReader = parseDiffHunk(patch);
	let diffHunkIter = diffHunkReader.next();
	const diffHunks = [];

	const right = [];
	while (!diffHunkIter.done) {
		const diffHunk = diffHunkIter.value;
		diffHunks.push(diffHunk);

		for (let j = 0; j < diffHunk.diffLines.length; j++) {
			const diffLine = diffHunk.diffLines[j];
			if (diffLine.type === DiffChangeType.Delete || diffLine.type === DiffChangeType.Control) {
			} else if (diffLine.type === DiffChangeType.Add) {
				right.push(diffLine.text);
			} else {
				const codeInFirstLine = diffLine.text;
				right.push(codeInFirstLine);
			}
		}

		diffHunkIter = diffHunkReader.next();
	}

	return diffHunks;
}

export function getModifiedContentFromDiffHunk(originalContent: string, patch: string) {
	const left = originalContent.split(/\r?\n/);
	const diffHunkReader = parseDiffHunk(patch);
	let diffHunkIter = diffHunkReader.next();
	const diffHunks = [];

	const right = [];
	let lastCommonLine = 0;
	while (!diffHunkIter.done) {
		const diffHunk = diffHunkIter.value;
		diffHunks.push(diffHunk);

		const oriStartLine = diffHunk.oldLineNumber;

		for (let j = lastCommonLine + 1; j < oriStartLine; j++) {
			right.push(left[j - 1]);
		}

		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		lastCommonLine = oriStartLine + diffHunk.oldLength - 1;

		for (let j = 0; j < diffHunk.diffLines.length; j++) {
			const diffLine = diffHunk.diffLines[j];
			if (diffLine.type === DiffChangeType.Delete || diffLine.type === DiffChangeType.Control) {
			} else if (diffLine.type === DiffChangeType.Add) {
				right.push(diffLine.text);
			} else {
				const codeInFirstLine = diffLine.text;
				right.push(codeInFirstLine);
			}
		}

		diffHunkIter = diffHunkReader.next();
	}

	if (lastCommonLine < left.length) {
		for (let j = lastCommonLine + 1; j <= left.length; j++) {
			right.push(left[j - 1]);
		}
	}

	return right.join('\n');
}

export function getModifiedContentFromDiffHunkAzdo(originalContent: string, diffHunks: DiffHunk[]) {
	const left = originalContent.split(/\r?\n/);

	const right = [];
	let lastCommonLine = 0;
	for (const diffHunk of diffHunks) {
		const oriStartLine = diffHunk.oldLineNumber;

		for (let j = lastCommonLine + 1; j < oriStartLine; j++) {
			right.push(left[j - 1]);
		}

		lastCommonLine = oriStartLine + diffHunk.oldLength - 1;

		for (let j = 0; j < diffHunk.diffLines.length; j++) {
			const diffLine = diffHunk.diffLines[j];
			if (diffLine.type === DiffChangeType.Delete || diffLine.type === DiffChangeType.Control) {
			} else if (diffLine.type === DiffChangeType.Add) {
				right.push(diffLine.text);
			} else {
				const codeInFirstLine = diffLine.text;
				right.push(codeInFirstLine);
			}
		}
	}

	if (lastCommonLine < left.length) {
		for (let j = lastCommonLine + 1; j <= left.length; j++) {
			right.push(left[j - 1]);
		}
	}

	return right.join('\n');
}

export function getGitChangeType(status: string): GitChangeType {
	switch (status) {
		case 'removed':
			return GitChangeType.DELETE;
		case 'added':
			return GitChangeType.ADD;
		case 'renamed':
			return GitChangeType.RENAME;
		case 'modified':
			return GitChangeType.MODIFY;
		default:
			return GitChangeType.UNKNOWN;
	}
}

export async function parseDiffAzdo(
	reviews: IAzdoRawFileChange[],
	repository: Repository,
	parentCommit: string,
): Promise<(InMemFileChange | SlimFileChange)[]> {
	const fileChanges: (InMemFileChange | SlimFileChange)[] = await Promise.all(reviews.map(r => parseSingleDiffAzdo(r, repository, parentCommit)));
	return fileChanges;
}

export async function parseSingleDiffAzdo(
	review: IAzdoRawFileChange,
	repository: Repository,
	parentCommit: string,
): Promise<(InMemFileChange | SlimFileChange)> {
	const gitChangeType = getGitChangeTypeFromVersionControlChangeType(review.status);

	if (review.diffHunks === undefined) {
		return new SlimFileChange(
			parentCommit,
			review.headCommit,
			review.blob_url,
			gitChangeType,
			review.filename,
			review.previous_filename,
			review.file_sha,
			review.previous_file_sha,
		);
	}

	let originalFileExist = false;

	switch (gitChangeType) {
		case GitChangeType.MODIFY:
			try {
				await repository.getObjectDetails(parentCommit, removeLeadingSlash(review.filename));
				originalFileExist = true;
			} catch (err) {
				/* noop */
			}
			break;
		case GitChangeType.RENAME:
		case GitChangeType.DELETE:
			try {
				await repository.getObjectDetails(parentCommit, removeLeadingSlash(review.previous_filename!));
				originalFileExist = true;
			} catch (err) {
				/* noop */
			}
			break;
	}

	const diffHunks = review.diffHunks ?? [];
	const isPartial = !originalFileExist && gitChangeType !== GitChangeType.ADD;
	return new InMemFileChange(
		parentCommit,
		review.headCommit,
		gitChangeType,
		review.filename,
		review.previous_filename,
		'review.patch',
		diffHunks,
		isPartial,
		review.blob_url,
		review.file_sha,
		review.previous_file_sha,
	);
}

export function getGitChangeTypeFromVersionControlChangeType(status: VersionControlChangeType): GitChangeType {
	// tslint:disable-next-line: no-bitwise
	if (status & VersionControlChangeType.Delete || status & VersionControlChangeType.SourceRename) {
		return GitChangeType.DELETE;
		// tslint:disable-next-line: no-bitwise
	} else if (status & VersionControlChangeType.Rename) {
		return GitChangeType.RENAME;
	} else if (status === VersionControlChangeType.Add) {
		return GitChangeType.ADD;
		// tslint:disable-next-line: no-bitwise
	} else if (status & VersionControlChangeType.Edit) {
		return GitChangeType.MODIFY;
	}
	return GitChangeType.UNKNOWN;
}
