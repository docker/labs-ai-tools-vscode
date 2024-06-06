import * as vscode from 'vscode';
import { generateRunbook } from './commands/generateRunbook';

import { runHotCommand } from './commands/runHotCommand';
import { setOpenAIKey } from './commands/setOpenAIKey';

export const workspaceCommands = {} as {
	[id: string]:
	{
		command: string;
		script: string;
	}[]
};

export const extensionId = 'docker.make-runbook';

export const packageJSON = vscode.extensions.getExtension(extensionId)?.packageJSON;

export let dockerLSP: any;

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

const pollLSPOrThrow = async (api: { getNativeClient: Function }) => new Promise((resolve, reject) => {
	let polls = 0;
	setInterval(() => {
		const dockerLSPVal = api.getNativeClient();
		if (dockerLSPVal) {
			return resolve(dockerLSPVal);
		}
		polls += 1;
		if (polls > MAX_POLL) {
			reject('Docker LSP not found. Make sure vscode-docker is version 1.26 or later.');
		}
	}, 500);
});

export async function activate(context: vscode.ExtensionContext) {
	const dockerExt = vscode.extensions.getExtension('ms-azuretools.vscode-docker');

	if (!dockerExt) {
		vscode.window.showErrorMessage('Please install the Docker extension to use this extension');
		return;
	}

	const [_major, minor, patch] = dockerExt.packageJSON.version.split('.');

	if (Number(minor) === 26 && Number(patch) < 6) {
		vscode.window.showErrorMessage(`Docker extension version ${dockerExt.packageJSON.version} is not supported. Please update to version 1.26.6 or later.`);
		return;
	}

	const api = await dockerExt.activate();

	dockerLSP = await pollLSPOrThrow(api);

	let setOpenAIKeyCommand = vscode.commands.registerCommand('docker.make-runbook.set-openai-api-key', () => {
		setOpenAIKey(context.secrets);
	});

	context.subscriptions.push(setOpenAIKeyCommand);


	let makeRunbook = vscode.commands.registerCommand('docker.make-runbook.generate', () => generateRunbook(context.secrets));

	context.subscriptions.push(makeRunbook);

	let runBoundCommands = vscode.commands.registerCommand('docker.make-runbook.run', runHotCommand);

	context.subscriptions.push(runBoundCommands);

	if (vscode.workspace.getConfiguration('docker.make-runbook').get('openai-base') === 'OpenAI') {
		void verifyHasOpenAIKey(context.secrets);
	}

	dockerLSP.onNotification("$bind/register", async (args: {
		uri: string, blocks: {
			command: string;
			script: string;
		}[]
	}) => {
		const blocks = args.blocks;

		const runbookURI = vscode.Uri.parse(args.uri);

		workspaceCommands[runbookURI.fsPath] = blocks;
	});

	dockerLSP.onNotification("$terminal/run", async (args: { content: string }) => {
		const terminal = vscode.window.createTerminal("Docker Runbook");
		terminal.sendText(args.content);
		terminal.show();

	});

	void dockerLSP.sendRequest("docker/markdown-blocks");
}
