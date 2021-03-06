import * as path from 'path';
import * as dotenv from 'dotenv';
import { runTests } from 'vscode-test';

async function go() {
	try {
		console.log(__dirname);
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
		const extensionTestsPath = path.resolve(__dirname, './');

		dotenv.config();

		/**
		 * Basic usage
		 */
		await runTests({
			version: 'insiders',
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				path.resolve(__dirname, '../../../test_workspace/'),
				'--disable-extensions',
				// '--user-data-dir=' + path.resolve(__dirname,'../../.temp'),
			],
		});
	} catch (e) {
		console.log(e);
	}
}

go();
