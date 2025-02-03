import { BasePromptElementProps, PromptElement, SystemMessage, UserMessage } from '@vscode/prompt-tsx';
import { ChatContext } from 'vscode';
import { History } from '../../core/prompts/chat.history';

export interface PullRequestData {
	id: number;
	title: string;
	description: string;
}

export interface FeedPromptData extends BasePromptElementProps {
	history: ChatContext['history'];
	userQuery: string;
	pullRequests: PullRequestData[];
}

export default class FeedPrompt extends PromptElement<FeedPromptData> {
	render() {
		const pullRequests = this.props.pullRequests
			.map(
				x => `
				# ${x.title} (${x.id})
				${x.description}
				`,
			)
			.join('\n');

		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					You are a personal assistant to a software engineer whose duties include timely reviewing pull requests.
					<br />
					# Instructions
					<br />
					List the pull requests and explain what a given change is about.
				</UserMessage>
				<History history={this.props.history} passPriority older={0} newer={80} />
				<UserMessage priority={90}>{this.props.userQuery}</UserMessage>
				<UserMessage priority={50}>
					# Pull requests
					<br />
					{pullRequests}
				</UserMessage>
			</>
		);
	}
}
