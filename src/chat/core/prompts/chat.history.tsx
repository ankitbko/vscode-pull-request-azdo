import {
	AssistantMessage,
	BasePromptElementProps,
	PrioritizedList,
	PromptElement,
	PromptPiece,
	UserMessage,
} from '@vscode/prompt-tsx';
import { ChatContext, ChatRequestTurn, ChatResponseMarkdownPart, ChatResponseTurn } from 'vscode';

interface IHistoryProps extends BasePromptElementProps {
	history: ChatContext['history'];
	newer: number; // last 2 message priority values
	older: number; // previous message priority values
	passPriority: true; // require this prop be set!
}

/**
 * We can wrap up this history element to be a little easier to use. `prompt-tsx`
 * has a `passPriority` attribute which allows an element to act as a 'pass-through'
 * container, so that its children are pruned as if they were direct children of
 * the parent. With this component, the elements
 *
 * ```
 * <HistoryMessages history={this.props.history.slice(0, -2)} priority={0} />
 * <HistoryMessages history={this.props.history.slice(-2)} priority={80} />
 * ```
 *
 * ...can equivalently be expressed as:
 *
 * ```
 * <History history={this.props.history} passPriority older={0} recentPriority={80} />
 * ```
 */
export class History extends PromptElement<IHistoryProps> {
	render(): PromptPiece {
		return (
			<>
				<HistoryMessages history={this.props.history.slice(0, -2)} priority={this.props.older} />
				<HistoryMessages history={this.props.history.slice(0, -2)} priority={this.props.newer} />
			</>
		);
	}
}

interface IHistoryMessagesProps extends BasePromptElementProps {
	history: ChatContext['history'];
}

/**
 * The History element simply lists user and assistant messages from the chat
 * context. If things like tool calls or file trees are relevant for, your
 * case, you can make this element more complex to handle those cases.
 */
export class HistoryMessages extends PromptElement<IHistoryMessagesProps> {
	render(): PromptPiece {
		const history: (UserMessage | AssistantMessage)[] = [];
		for (const turn of this.props.history) {
			if (turn instanceof ChatRequestTurn) {
				history.push(<UserMessage>{turn.prompt}</UserMessage>);
			} else if (turn instanceof ChatResponseTurn) {
				history.push(<AssistantMessage name={turn.participant}>{chatResponseToMarkdown(turn)}</AssistantMessage>);
			}
		}
		return (
			<PrioritizedList priority={0} descending={false}>
				{history}
			</PrioritizedList>
		);
	}
}

const chatResponseToMarkdown = (response: ChatResponseTurn) => {
	let str = '';
	for (const part of response.response) {
		if (response instanceof ChatResponseMarkdownPart) {
			str += part.value;
		}
	}

	return str;
};
