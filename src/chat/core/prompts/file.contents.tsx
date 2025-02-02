import {
	BasePromptElementProps,
	PromptElement,
	PromptPiece,
	PromptSizing,
} from '@vscode/prompt-tsx';
import { TextDocument } from 'vscode';

export interface IFilesToInclude {
	document: TextDocument;
	line: number;
}


export default class FileContext extends PromptElement<{ files: IFilesToInclude[] } & BasePromptElementProps> {
	async render(_state: void, sizing: PromptSizing): Promise<PromptPiece> {
		const files = await this.getExpandedFiles(sizing);
		return <>{files.map(f => f.toString())}</>;
	}

	/**
	 * The idea here is:
	 *
	 * 1. We wrap each file in markdown-style code fences, so get the base
	 *    token consumption of each of those.
	 * 2. Keep looping through the files. Each time, add one line from each file
	 *    until either we're out of lines (anyHadLinesToExpand=false) or until
	 *    the next line would cause us to exceed our token budget.
	 *
	 * This always will produce files that are under the budget because
	 * tokenization can cause content on multiple lines to 'merge', but it will
	 * never exceed the budget.
	 *
	 * (`tokenLength(a) + tokenLength(b) <= tokenLength(a + b)` in all current
	 * tokenizers.)
	 */
	private async getExpandedFiles(sizing: PromptSizing) {
		const files = this.props.files.map(f => new FileContextTracker(f.document, f.line));

		let tokenCount = 0;
		// count the base amount of tokens used by the files:
		for (const file of files) {
			tokenCount += await file.tokenCount(sizing);
		}

		while (true) {
			let anyHadLinesToExpand = false;
			for (const file of files) {
				const nextLine = file.nextLine();
				if (nextLine === undefined) {
					continue;
				}

				anyHadLinesToExpand = true;
				const nextTokenCount = await sizing.countTokens(nextLine);
				if (tokenCount + nextTokenCount > sizing.tokenBudget) {
					return files;
				}

				file.expand();
				tokenCount += nextTokenCount;
			}

			if (!anyHadLinesToExpand) {
				return files;
			}
		}
	}
}

class FileContextTracker {
	private prefix = `# ${this.document.fileName}\n\`\`\`\n`;
	private suffix = '\n```\n';
	private lines: string[] = [];

	private aboveLine = this.originLine;
	private belowLine = this.originLine;
	private nextLineIs: 'above' | 'below' | 'none' = 'above';

	constructor(private readonly document: TextDocument, private readonly originLine: number) {}

	/** Counts the length of the current data. */
	public async tokenCount(sizing: PromptSizing) {
		const before = await sizing.countTokens(this.prefix);
		const after = await sizing.countTokens(this.suffix);
		return before + after;
	}

	/** Gets the next line that will be added on the following `expand` call. */
	public nextLine(): string | undefined {
		switch (this.nextLineIs) {
			case 'above':
				return this.document.lineAt(this.aboveLine).text + '\n';
			case 'below':
				return this.document.lineAt(this.belowLine).text + '\n';
			case 'none':
				return undefined;
		}
	}

	/** Adds in the 'next line' */
	public expand() {
		if (this.nextLineIs === 'above') {
			this.lines.unshift(this.document.lineAt(this.aboveLine).text);
			if (this.belowLine < this.document.lineCount - 1) {
				this.belowLine++;
				this.nextLineIs = 'below';
			} else if (this.aboveLine > 0) {
				this.aboveLine--;
			} else {
				this.nextLineIs = 'none';
			}
		} else if (this.nextLineIs === 'below') {
			this.lines.push(this.document.lineAt(this.belowLine).text);
			if (this.aboveLine > 0) {
				this.aboveLine--;
				this.nextLineIs = 'above';
			} else if (this.belowLine < this.document.lineCount - 1) {
				this.belowLine++;
			} else {
				this.nextLineIs = 'none';
			}
		}
	}

	/** Gets the file content as a string. */
	toString() {
		return this.prefix + this.lines.join('\n') + this.suffix;
	}
}
