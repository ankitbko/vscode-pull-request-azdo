import { AssistantMessage, BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';

export interface HighlightPromptData extends BasePromptElementProps {
	query: string;
}

export default class extends PromptElement<HighlightPromptData> {
	render(_state: void, _sizing: PromptSizing) {
		return (
			<>
				<AssistantMessage>TBD</AssistantMessage>
				<UserMessage>
					TBD
					{this.props.query}
				</UserMessage>
			</>
		);
	}
}
