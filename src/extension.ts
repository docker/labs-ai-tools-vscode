import * as vscode from 'vscode';
import { runPrompt } from './commands/runPrompt';

import { runHotCommand } from './commands/runHotCommand';
import { setOpenAIKey } from './commands/setOpenAIKey';
import { nativeClient } from './utils/lsp';
import { deletePrompt, savePrompt } from './commands/manageSavedPrompts';
import { spawnSync } from 'child_process';
import semver from 'semver';

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


const getLatestVersion = async () => {
	const resp = (await fetch(
		"https://api.github.com/repos/docker/labs-make-runbook/releases/latest"
	)
		.then((r) => r.json())
		.catch(() => null)) as { name: string } | null;

	const version = resp?.name?.split("v")[1]?.split(" ")[0];
	return version;
};


const checkVersion = (context: vscode.ExtensionContext) => {
	const currentVersion = packageJSON.version;
	void getLatestVersion().then((latestVersion) => {
		if (!latestVersion) {
			throw new Error("Failed to check for updates");
		}
		const updateAvail = semver.gt(latestVersion, currentVersion);
		if (updateAvail && !currentVersion.includes('development')) {
			void vscode.window.showWarningMessage(
				`Docker AI Tools may be ready for an update. You have ${currentVersion} but latest is ${latestVersion}`,
				"Update"
			).then(
				(a) =>
					a &&
					a === "Update" &&
					vscode.env.openExternal(
						vscode.Uri.parse(
							"https://github.com/docker/labs-make-runbook/releases"
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
	checkOutdatedVersionInstalled();
	checkVersion(context);
	ctx = context;
	let setOpenAIKeyCommand = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.set-openai-api-key', () => {
		setOpenAIKey(context.secrets);
	});
	context.subscriptions.push(setOpenAIKeyCommand);


	spawnSync('docker', ['pull', "vonwig/prompts:latest"]);

	let runPromptCommand = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.run-prompt', () => runPrompt(context.secrets));

	context.subscriptions.push(runPromptCommand);

	let runBoundCommands = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.run-commands', runHotCommand);

	context.subscriptions.push(runBoundCommands);

	let savePromptCommand = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.save-prompt', savePrompt);

	context.subscriptions.push(savePromptCommand);

	let deletePromptCommand = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.delete-prompt', deletePrompt);

	context.subscriptions.push(deletePromptCommand);

	let runWorkspaceAsPrompt = vscode.commands.registerCommand('docker.labs-ai-tools-vscode.run-workspace-as-prompt', () => runPrompt(context.secrets, true));

	context.subscriptions.push(runWorkspaceAsPrompt);

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
