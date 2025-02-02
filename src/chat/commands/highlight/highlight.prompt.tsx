import { BasePromptElementProps, PromptElement, SystemMessage, UserMessage } from '@vscode/prompt-tsx';
import { ChatContext } from 'vscode';
import { History } from '../../core/prompts/chat.history';
import FileContext, { IFilesToInclude } from '../../core/prompts/file.contents';

export interface HighlightPromptData extends BasePromptElementProps {
	history: ChatContext['history'];
	userQuery: string;
	referencedFiles: IFilesToInclude[];
	reviewableFiles: IFilesToInclude[];
	description: string;
}

export default class HighlightPrompt extends PromptElement<HighlightPromptData> {
	render() {
		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					Imagine a scenario where you act like an expert software engineer reviewing a pull request.
					<br />
					# Instructions
					<br />
					Take a deep breath and think what is the high level rationale of this change and how well it is implemented.
					Carefully analyze the description and the files changed to provide a constructive feedback.
				</UserMessage>
				<History history={this.props.history} passPriority older={0} newer={80} />
				<UserMessage priority={90}>{this.props.userQuery}</UserMessage>
				<UserMessage priority={70}>{this.props.description}</UserMessage>
				<FileContext priority={60} flexGrow={1} files={this.props.reviewableFiles} />
				<FileContext priority={70} flexGrow={1} files={this.props.referencedFiles} />
			</>
		);
	}
}
