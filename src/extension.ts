import * as vscode from 'vscode';
import { generateRunbook } from './commands/generateRunbook';

import { runHotCommand } from './commands/runHotCommand';
import { setOpenAIKey } from './commands/setOpenAIKey';
import { nativeClient } from './utils/lsp';
import { deletePrompt, savePrompt } from './commands/manageSavedPrompts';
import { spawnSync } from 'child_process';

export const workspaceCommands = {} as {
	[id: string]:
	{
		command: string;
		script: string;
	}[]
};

export const extensionId = 'docker.make-runbook';

export const packageJSON = vscode.extensions.getExtension(extensionId)?.packageJSON;

const MAX_POLL = 10;

export const verifyHasOpenAIKey = async (secrets: vscode.SecretStorage, didRunAutomatically = false) => {
	const openAIKey = await secrets.get('openAIKey');
	if (!openAIKey) {
		await vscode.window.showErrorMessage('Model provider set to OpenAI, but no OpenAI API key found in secrets.', {
			modal: didRunAutomatically
		}, 'Set Key', 'Use Ollama',).then(
			async (res) => {
				if (res === 'Set Key') {
					await setOpenAIKey(secrets, true);
				}
				else if (res === 'Use Ollama') {
					await vscode.workspace.getConfiguration('docker.make-runbook').update('openai-base', 'Ollama');
				}
				else {
					return false;
				}
			});
	}
};

export async function activate(context: vscode.ExtensionContext) {

	let setOpenAIKeyCommand = vscode.commands.registerCommand('docker.make-runbook.set-openai-api-key', () => {
		setOpenAIKey(context.secrets);
	});

	context.subscriptions.push(setOpenAIKeyCommand);

	spawnSync('docker', ['pull', "vonwig/prompts:latest"]);

	let makeRunbook = vscode.commands.registerCommand('docker.make-runbook.generate', () => generateRunbook(context.secrets));

	context.subscriptions.push(makeRunbook);

	let runBoundCommands = vscode.commands.registerCommand('docker.make-runbook.run', runHotCommand);

	context.subscriptions.push(runBoundCommands);

	let savePromptCommand = vscode.commands.registerCommand('docker.make-runbook.save-prompt', savePrompt);

	context.subscriptions.push(savePromptCommand);

	let deletePromptCommand = vscode.commands.registerCommand('docker.make-runbook.delete-prompt', deletePrompt);

	context.subscriptions.push(deletePromptCommand);

	if (vscode.workspace.getConfiguration('docker.make-runbook').get('openai-base') === 'OpenAI') {
		void verifyHasOpenAIKey(context.secrets);
	}

	nativeClient.onNotification("$bind/register", async (args: {
		uri: string, blocks: {
			command: string;
			script: string;
		}[]
	}) => {
		const blocks = args.blocks;

		const runbookURI = vscode.Uri.parse(args.uri);

		workspaceCommands[runbookURI.fsPath] = blocks;
	});

	nativeClient.onNotification("$terminal/run", async (args: { content: string }) => {
		const terminal = vscode.window.createTerminal("Docker Runbook");
		terminal.sendText(args.content);
		terminal.show();

	});

	void nativeClient.sendRequest("docker/markdown-blocks");
}
