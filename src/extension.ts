import * as vscode from 'vscode';
import { showSetSecretDialog } from './commands/secrets';
import { nativeClient } from './utils/lsp';
import { spawn, spawnSync } from 'child_process';
import semver from 'semver';
import commands from './commands';
import { postToBackendSocket, setDefaultProperties } from './utils/ddSocket';
import { checkDockerDesktop } from './utils/dockerDesktop';

export let ctx: vscode.ExtensionContext;

export const workspaceCommands = {} as {
	[id: string]:
	{
		command: string;
		script: string;
	}[]
};

export const extensionId = 'docker.labs-ai-tools-vscode';

export const packageJSON = vscode.extensions.getExtension(extensionId)?.packageJSON;

export const extensionOutput = vscode.window.createOutputChannel('Docker Labs AI', 'json')


const getLatestVersion = async () => {
	const resp = (await fetch(
		"https://api.github.com/repos/docker/labs-ai-tools-vscode/releases/latest"
	)
		.then((r) => r.json())
		.catch(() => null)) as { name: string } | null;

	const version = resp?.name
	return version;
};


const checkVersion = () => {
	const currentVersion = packageJSON.version;
	void getLatestVersion().then((latestVersion) => {
		if (!latestVersion) {
			throw new Error("Failed to check for updates");
		}
		const updateAvail = semver.gt(latestVersion, currentVersion);
		if (updateAvail && !currentVersion.includes('development')) {
			void vscode.window.showWarningMessage(
				`Docker AI Tools may be ready for an update. You have ${currentVersion} but latest is ${latestVersion}`,
				"Update",
				"Continue"
			).then(
				(a) =>
					a &&
					a === "Update" &&
					vscode.env.openExternal(
						vscode.Uri.parse(
							"https://github.com/docker/labs-ai-tools-vscode/releases"
						)
					)
			);
		}
	});
};

const checkOutdatedVersionInstalled = async () => {
	const ext = vscode.extensions.getExtension('docker.make-runbook');
	if (!ext) {
		return;
	}
	await vscode.window.showErrorMessage("Outdated Extension", { modal: true, detail: "You have an outdated version of Docker AI Tools installed. Please uninstall labs-make-runbook and restart your editor." }, "Uninstall",).then((a) => {
		if (a === "Uninstall") {
			vscode.commands.executeCommand("workbench.extensions.action.showExtensionsWithIds", ['docker.make-runbook']);
		}
	});
};

export async function activate(context: vscode.ExtensionContext) {
	const result = await checkDockerDesktop();
	if (result === 'RETRY') {
		return vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
	checkOutdatedVersionInstalled();
	checkVersion();
	setDefaultProperties(context);
	postToBackendSocket({ event: 'eventLabsPromptActivated' });
	ctx = context;
	let setProviderSecretCommand = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.set-secret', () => {
		showSetSecretDialog(context.secrets);
	});
	context.subscriptions.push(setProviderSecretCommand);

	const pullPromptImage = () => {
		const process = spawn('docker', ['pull', "vonwig/prompts:latest"]);
		process.stdout.on('data', (data) => {
			console.error(data.toString());
		});
		process.stderr.on('data', (data) => {
			console.error(data.toString());
		});
	}

	pullPromptImage();

	const registeredCommands = commands(context)

	context.subscriptions.push(...registeredCommands)

	nativeClient.onNotification("$bind/register", async (args: {
		uri: string, blocks: {
			command: string;
			script: string;
		}[]
	}) => {
		const blocks = args.blocks;

		const PromptRespURI = vscode.Uri.parse(args.uri);

		workspaceCommands[PromptRespURI.fsPath] = blocks;
	});

	nativeClient.onNotification("$terminal/run", async (args: { content: string }) => {
		const terminal = vscode.window.createTerminal("Markdown Blocks");
		terminal.sendText(args.content);
		terminal.show();

	});

	void nativeClient.sendRequest("docker/markdown-blocks");

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			[{ language: "markdown" }],
			{
				provideInlineCompletionItems(
					document: vscode.TextDocument,
					position: vscode.Position,
					context: vscode.InlineCompletionContext,
				): vscode.ProviderResult<
					vscode.InlineCompletionItem[] | vscode.InlineCompletionList
				> {
					return nativeClient.sendRequest("textDocument/inlineCompletion", {
						context: {
							uri: document.uri.toString(),
							position: position,
							triggerKind: context.triggerKind,
						},
					});
				},
			}
		)
	);
}
