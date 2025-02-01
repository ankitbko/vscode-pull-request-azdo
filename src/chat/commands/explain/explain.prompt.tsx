// import { AssistantMessage, BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';

// export interface ExplainPromptData extends BasePromptElementProps {
// 	description: string;
// 	changedFiles: string[];
// 	workItemDescriptions: string[];
// }

// export default class extends PromptElement<ExplainPromptData> {
// 	render(_state: void, _sizing: PromptSizing) {
// 		return (
// 			<>
// 				<AssistantMessage>
// 					# Context
// 					<br />
// 					Imagine a scenario where you act like an expert software engineer helping review a pull request.
// 					<br />
// 					# Instructions
// 					<br />
// 					Your task is to provide a high-level summary of the changes made covering the following aspects:
// 					<br />
// 					- Why were the changes made?
// 					<br />
// 					- What is the design of the changes?
// 					<br />
// 					- Is there any technical debt introduced?
// 					<br />- What are the risks associated with the changes?
// 				</AssistantMessage>
// 				<UserMessage>
// 					Help me review the following pull request: # User-provided description
// 					<br />
// 					{this.props.description}
// 					<br />
// 					# Corresponding work item
// 					<br />
// 					{this.props.workItemDescriptions.forEach(
// 						(workItemDescription, index) => `
// 					# Work item ${index}
// 					${workItemDescription}

// 					`,
// 					)}
// 					<br />
// 					# Changes made
// 					<br />
// 					{this.props.changedFiles.forEach(changedFile => `- ${changedFile}`)}
// 				</UserMessage>
// 			</>
// 		);
// 	}
// }
