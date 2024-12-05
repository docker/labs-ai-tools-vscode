import {
    spawnSync,
} from "child_process";
import * as vscode from "vscode";
import { showPromptPicker } from "../utils/promptPicker";
import { createOutputBuffer } from "../utils/promptFilename";
import { spawnPromptImage, writeKeyToVolume } from "../utils/promptRunner";
import { verifyHasOpenAIKey } from "./setOpenAIKey";
import { getCredential } from "../utils/credential";
import { setProjectDir } from "./setProjectDir";
import { postToBackendSocket } from "../utils/ddSocket";
import { extensionOutput } from "../extension";
import { randomUUID } from "crypto";

type PromptOption = 'local-dir' | 'local-file' | 'remote';

const getWorkspaceFolder = async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return;
    }

    let workspaceFolder = workspaceFolders[0];

    if (workspaceFolders.length > 1) {
        // Multi-root workspace support WIP
        const option = await vscode.window.showQuickPick(workspaceFolders.map(f => ({ label: f.name, detail: f.uri.fsPath, index: f.index })), {
            title: "Select workspace",
            ignoreFocusOut: true,
        });
        if (!option) {
            return;
        }
        workspaceFolder = workspaceFolders[option.index];
    }

    return workspaceFolder;
};


export const runPrompt: (secrets: vscode.SecretStorage, mode: PromptOption) => void = (secrets: vscode.SecretStorage, mode: PromptOption) => vscode.window.withProgress({ location: vscode.ProgressLocation.Window, cancellable: true }, async (progress, token) => {
    progress.report({ increment: 1, message: "Starting..." });
    postToBackendSocket({ event: 'eventLabsPromptRunPrepare', properties: { mode } });
    progress.report({ increment: 5, message: "Checking for OpenAI key..." });

    const hasOpenAIKey = await verifyHasOpenAIKey(secrets, true);
    if (!hasOpenAIKey) {
        return;
    }

    progress.report({ increment: 5, message: "Checking for workspace..." });

    progress.report({ increment: 5, message: "Checking for prompt..." });

    const workspaceFolder = await getWorkspaceFolder();

    const inputWorkspace = await vscode.commands.executeCommand<ReturnType<typeof setProjectDir>>('docker.labs-ai-tools-vscode.project-dir', false);

    const promptOption = mode === 'remote' ? await showPromptPicker() : { id: `${mode === 'local-dir' ? `local://${inputWorkspace}` : `local://${vscode.window.activeTextEditor?.document.uri.fsPath}`}`, name: `Local Prompt (${mode})` };

    if (!promptOption) {
        return;
    }
    const runningLocal = promptOption.id.startsWith('local://');

    postToBackendSocket({ event: 'eventLabsPromptRunStart', properties: { mode, ref: runningLocal ? 'local' : promptOption.id } });

    if (!runningLocal && !workspaceFolder) {
        return vscode.window.showErrorMessage("No workspace selected. Either open a workspace or run a local prompt.", "Open workspace", "Run local prompt").then((value) => {
            if (!value) {
                return;
            }
            if (value === "Open workspace") {
                vscode.commands.executeCommand("workbench.action.files.openFolder");
            }
            else if (value === "Run local prompt") {
                vscode.commands.executeCommand("docker.labs-ai-tools-vscode.run-file-as-prompt");
            }
        });
    }

    if (runningLocal && !inputWorkspace) {
        return vscode.window.showErrorMessage("No project path set. Please set the project path in settings or run a local prompt from a workspace.");
    }

    const hostDir = runningLocal ? inputWorkspace! : workspaceFolder!.uri.fsPath;

    progress.report({ increment: 5, message: "Checking for project path..." });

    progress.report({ increment: 5, message: "Writing prompt output file..." });

    const apiKey = await secrets.get("openAIKey");

    const { editor, doc } = await createOutputBuffer('prompt-output' + randomUUID() + '.md', hostDir);

    if (!editor || !doc) {
        postToBackendSocket({ event: 'eventLabsPromptError', properties: { error: 'No editor or document found' } });
        return;
    }

    const writeToEditor = (text: string, range?: vscode.Range) => {
        const edit = new vscode.WorkspaceEdit();
        if (range) {
            edit.replace(doc.uri, range, text);
        }
        else {
            editor.edit((builder) => {
                builder.insert(new vscode.Position(doc.lineCount, 0), text);
            });
        }
        return vscode.workspace.applyEdit(edit);
    };

    progress.report({ increment: 5, message: "Detecting docker desktop token" });

    const { Username, Password } = await getCredential("docker");

    try {
        progress.report({ increment: 5, message: "Mounting secrets..." });
        await writeKeyToVolume(apiKey!);
        progress.report({ increment: 5, message: "Running..." });
        const ranges: Record<string, vscode.Range> = {};
        const getBaseFunctionRange = () => new vscode.Range(doc.lineCount, 0, doc.lineCount, 0);
        const platformArg = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
        await spawnPromptImage(promptOption.id, hostDir, Username || 'vscode-user', Password, platformArg, async (json) => {
            extensionOutput.appendLine(JSON.stringify(json))
            switch (json.method) {
                case 'functions':
                    const { id, function: { arguments: args, name } } = json.params;
                    const params_str = args;
                    let functionRange = ranges[id] || getBaseFunctionRange();
                    if (functionRange.isSingleLine) {
                        // Add function to the end of the file and update the range
                        progress.report({ increment: 0, message: `Running ${name}` });
                        await writeToEditor(`\`\`\`json\n${params_str}`);
                        functionRange = new vscode.Range(functionRange.start.line, functionRange.start.character, doc.lineCount, 0);
                    }
                    else {
                        // Replace existing function and update the range
                        await writeToEditor(params_str, functionRange);
                        functionRange = new vscode.Range(functionRange.start.line, functionRange.start.character, functionRange.end.line + params_str.split('\n').length, 0);
                    }
                    ranges[id] = functionRange;
                    break;
                case 'start':
                    const { level, role, content } = json.params;
                    const header = Array(level + 1).fill('#').join('');
                    await writeToEditor(`${header} ROLE ${role}${content ? ` (${content})` : ''}\n\n`);
                    break;
                case 'functions-done':
                    await writeToEditor('\n```' + `\n\n*entering tool*\n\n`);
                    break;
                case 'message':
                    await writeToEditor(json.params.content);
                    if (json.params.debug && vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode').get<boolean>('debug')) {
                        const backticks = '\n```\n';
                        await writeToEditor(`${backticks}# Debug\n${json.params.debug}\n${backticks}\n`);
                    }
                    break;
                case 'prompts':
                    if (!vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode').get<boolean>('debug')) {
                        break;
                    }
                    const promptHeader = '# Rendered Prompt\n\n';
                    if (!doc.getText().includes(promptHeader)) {
                        await writeToEditor(promptHeader);
                    }
                    await writeToEditor(json.params.messages.map((m: any) => `# ${m.role}\n${m.content}`).join('\n') + '\n');
                    break;
                case 'error':
                    const errorMSG = String(json.params.content) + String(json.params.message) + String(json.params.message)
                    await writeToEditor('```error\n' + errorMSG + '\n```\n');
                    postToBackendSocket({ event: 'eventLabsPromptError', properties: { error: errorMSG } });
                    break;
                default:
                    await writeToEditor(JSON.stringify(json, null, 2));
            }
        }, token);
        await doc.save();
    } catch (e: unknown) {
        void vscode.window.showErrorMessage("Error running prompt");
        await writeToEditor('```json\n' + (e as Error).toString() + '\n```');
        postToBackendSocket({ event: 'eventLabsPromptError', properties: { error: (e as Error).toString() } });
        return;
    }
    postToBackendSocket({ event: 'eventLabsPromptFinished', properties: { mode } });
});