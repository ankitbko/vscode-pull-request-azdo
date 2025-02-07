import { BasePromptElementProps, PromptElement, SystemMessage, UserMessage } from '@vscode/prompt-tsx';
import { ChatContext } from 'vscode';
import { History } from '../../core/prompts/chat.history';
import FileContext, { IFilesToInclude } from '../../core/prompts/file.contents';

export interface ReviewPromptData extends BasePromptElementProps {
	prDescription: string;
	prTitle: string;
	fileName: string;
	diffHunk: string;
}

export default class ReviewPrompt extends PromptElement<ReviewPromptData> {
	render() {
		const jsonString = JSON.stringify({
			description: '<description of changes in this file>',
			comments: [
				{
					lineNumber: '<line number of right file>',
					reviewComment: '<detail review comment including potential fix>',
				},
			],
		});
		return (
			<>
				<UserMessage priority={100}>
					# Context
					<br />
					You are a very experienced principal software developer tasked to review the PR. You will be given a diff
					hunk of a single file to be reviewed. You should analyze the hunk and should return back review comments and
					specific line where comment needs to be displayed.
					<br />
					# Instruction
					<br />
					- Take a deep breath and think what is the high level rationale of this change and how well it is
					implemented.
					<br />
					- If you think no review comment is required then do not give it.
					<br />
					- Only write review comment that you are absolutely confident about.
					<br />
					- Do not write a review comment just for the sake of commenting.
					<br />
					- Remember this PR could have changes in multiple files but you are given only a file to review.
					<br />
					- In addition, you should also write a short description of changes in this particular file.
					<br />
					# Output Format
					<br />
					You should return the result in a JSON as per below format:
					{jsonString}
				</UserMessage>
				<UserMessage priority={100}>
					PR Title: {this.props.prTitle}. PR Description: {this.props.prDescription}.
				</UserMessage>
				<UserMessage priority={80}>
					File Name: {this.props.fileName}. The Diff Hunk: {this.props.diffHunk}
				</UserMessage>
			</>
		);
	}
}
