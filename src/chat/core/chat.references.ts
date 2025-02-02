
import * as vscode from 'vscode';
import { IFilesToInclude } from './prompts/file.contents';


const resolveReferences = async function* (references: readonly vscode.ChatPromptReference[]): AsyncGenerator<IFilesToInclude, void, unknown> {
	for (const reference of references) {
		const { value, range } = reference;
		if (value instanceof vscode.Uri) {
			const doc = await vscode.workspace.openTextDocument(value);
			yield { document: doc, line: range?.[0] ?? -1 };
		} else if (value instanceof vscode.Location) {
			const doc = await vscode.workspace.openTextDocument(value.uri);
			yield { document: doc, line: range?.[0] ?? -1 };
		}
	}
};

const resolveAllReferences = async (references: readonly vscode.ChatPromptReference[]): Promise<IFilesToInclude[]> => {
	const docs: IFilesToInclude[] = [];
	for await (const doc of resolveReferences(references)) {
		docs.push(doc);
	}
	return docs;
};

export {
	resolveReferences,
	resolveAllReferences
};
