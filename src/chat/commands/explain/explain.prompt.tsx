import { BasePromptElementProps, PromptElement, UserMessage } from '@vscode/prompt-tsx';
import { ChatContext } from 'vscode';
import { History } from '../../core/prompts/chat.history';
import FileContext, { IFilesToInclude } from '../../core/prompts/file.contents';

export interface ExplainPromptData extends BasePromptElementProps {
	history: ChatContext['history'];
	userQuery: string;
	referencedFiles: IFilesToInclude[];
	description: string;
	allFilesChanged: string[];
	referencedWorkItems: string[];
}

export default class ExplainPrompt extends PromptElement<ExplainPromptData> {
	render() {
		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					Imagine a scenario where you act like an expert software engineer helping review a pull request.
					<br />
					# Instructions
					<br />
					Your task is to provide a high-level summary of the changes made covering the following aspects:
					<br />
					- Why were the changes made?
					<br />
					- What is the design of the changes?
					<br />
					- Is there any technical debt introduced?
					<br />- What are the risks associated with the changes?
				</UserMessage>
				<History history={this.props.history} passPriority older={0} newer={80} />
				<UserMessage priority={90}>{this.props.userQuery}</UserMessage>
				<UserMessage priority={70}>{this.props.description}</UserMessage>
				<FileContext priority={70} flexGrow={1} files={this.props.referencedFiles} />
			</>
		);
	}
}
