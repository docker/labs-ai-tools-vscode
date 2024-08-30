import {
    spawnSync,
} from "child_process";
import * as vscode from "vscode";
import { showPromptPicker } from "../utils/promptPicker";
import { createOutputBuffer } from "../utils/promptFilename";
import { spawnPromptImage, writeKeyToVolume } from "../utils/promptRunner";
import { verifyHasOpenAIKey } from "./setOpenAIKey";
import { getCredential } from "../utils/credential";

const START_DOCKER_COMMAND = {
    'win32': 'Start-Process -NoNewWindow -Wait -FilePath "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"',
    'darwin': 'open -a Docker',
    'linux': 'systemctl --user start docker-desktop',
};

const checkDockerDesktop = () => {
    // Coerce the error to have an exit code
    type DockerSpawnError = Error & { code: number };

    try {
        const res = spawnSync("docker", ["version"]);

        if (res.error) {
            // Using -1 to indicate docker is not installed
            (res.error as DockerSpawnError).code = -1;
            throw res.error;
        }

        if (res.status !== 0) {
            const err = new Error(`Docker command exited with code ${res.status} and output the following error: ${res.error || res.stderr.toString()}`);
            // Using -1 as a fallback, should have already been caught by res.error
            (err as DockerSpawnError).code = res.status || -1;
            throw err;
        }

        // @ts-expect-error
    } catch (e: DockerSpawnError) {
        const platform = process.platform;
        const actionItems = e.code !== -1 ? [(platform in START_DOCKER_COMMAND ? "Start Docker" : "Try again")] : ["Install Docker Desktop", "Try again"];
        return vscode.window.showErrorMessage("Error starting Docker", { modal: true, detail: (e as DockerSpawnError).toString() }, ...actionItems).then(async (value) => {
            switch (value) {
                case "Start Docker":
                    spawnSync(START_DOCKER_COMMAND[platform as keyof typeof START_DOCKER_COMMAND], { shell: true });
                case "Install Docker Desktop":
                    vscode.env.openExternal(vscode.Uri.parse("https://www.docker.com/products/docker-desktop"));
                    return;
                case "Try again":
                    return 'RETRY';
            }
        });
    }
};

const getWorkspaceFolder = async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        await vscode.window.showErrorMessage("No workspace open");
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
            await vscode.window.showErrorMessage("No workspace selected");
            return;
        }
        workspaceFolder = workspaceFolders[option.index];
    }

    return workspaceFolder;
};

// When running local workspace as a prompt, we need to use a config value to determine the project path
const checkHasInputWorkspace = async () => {
    const existingPath = vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode').get('project_dir');
    if (!existingPath) {
        const resp = await vscode.window.showErrorMessage("No project path set in settings", "Set project path", "Cancel");
        if (resp === "Set project path") {
            const resp = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: "Select project path",
            });
            if (resp) {
                await vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode').update('project_dir', resp[0].fsPath);
                vscode.window.showInformationMessage(`Project path set to ${resp[0].fsPath}. You can change this in settings.`);
                return resp[0].fsPath;
            }
        }
        return;
    }
    return existingPath;
};

export const runPrompt: (secrets: vscode.SecretStorage, localWorkspace?: boolean) => void = (secrets: vscode.SecretStorage, localWorkspace = false) => vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async progress => {

    const result = await checkDockerDesktop();
    if (result === 'RETRY') {
        return runPrompt(secrets, localWorkspace);
    }

    progress.report({ increment: 0, message: "Starting..." });
    progress.report({ increment: 5, message: "Checking for OpenAI key..." });

    const hasOpenAIKey = await verifyHasOpenAIKey(secrets, true);
    if (!hasOpenAIKey) {
        return;
    }

    progress.report({ increment: 5, message: "Checking for workspace..." });
    const workspaceFolder = await getWorkspaceFolder();
    if (!workspaceFolder) {
        return;
    }


    progress.report({ increment: 5, message: "Checking for prompt..." });

    let promptDir = workspaceFolder.uri.fsPath;


    let promptOption = localWorkspace ? { id: `local://${promptDir}` } : await showPromptPicker();


    if (!promptOption) {
        return;
    }

    progress.report({ increment: 5, message: "Checking for project path..." });
    if (localWorkspace) {
        const projectPath = await checkHasInputWorkspace();
        if (!projectPath) {
            vscode.window.showErrorMessage("No project path set in settings");
            return;
        }
    }

    progress.report({ increment: 5, message: "Writing prompt output file..." });
    const apiKey = await secrets.get("openAIKey");

    const { editor, doc } = (await createOutputBuffer(workspaceFolder, promptOption.id) || {});

    if (!editor || !doc) {
        return;
    }

    const writeToEditor = (text: string, range?: vscode.Range) => {
        const edit = new vscode.WorkspaceEdit();
        if (range) {
            edit.replace(doc.uri, range, text);
        }
        else {
            edit.insert(doc.uri, new vscode.Position(doc.lineCount, 0), text);
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
        await spawnPromptImage(promptOption.id, localWorkspace ? (await vscode.workspace.getConfiguration('docker.labs-ai-tools-vscode').get('project_dir')) || '' : workspaceFolder.uri.fsPath, Username, process.platform, Password, (json) => {
            if (json.method === 'functions') {
                const functions = json.params;
                for (const func of functions) {
                    const { id, function: { arguments: args } } = func;
                    const params_str = args;
                    let functionRange = ranges[id] || getBaseFunctionRange();
                    if (functionRange.isSingleLine) {
                        // Add function to the end of the file and update the range
                        writeToEditor(params_str);
                        functionRange = new vscode.Range(functionRange.start.line, functionRange.start.character, doc.lineCount, 0);
                    }
                    else {
                        // Replace existing function and update the range
                        writeToEditor(params_str, functionRange);
                        functionRange = new vscode.Range(functionRange.start.line, functionRange.start.character, functionRange.end.line + params_str.split('\n').length, 0);
                    }
                    ranges[id] = functionRange;
                }
            }
            else if (json.method === 'message') {
                writeToEditor(json.params.content).then(() => {
                    if (json.params.debug) {
                        const backticks = '\n```\n';
                        writeToEditor(`${backticks}# Debug\n${json.params.debug}\n${backticks}\n`);
                        // Fold the section
                        vscode.commands.executeCommand('workbench.action.editor.toggleFold');

                    }
                });
            }
            else if (json.method === 'prompts') {
                const promptHeader = '# Rendered Prompt\n\n';
                if (!doc.getText().includes(promptHeader)) {
                    writeToEditor(promptHeader);
                }
                writeToEditor(json.params.messages.map((m: any) => JSON.stringify(m, null, 2)).join('\n') + '\n');
            }
            else {
                writeToEditor(JSON.stringify(json, null, 2));
            }
        });
        await doc.save();
    } catch (e: unknown) {
        e = e as Error;
        void vscode.window.showErrorMessage("Error running prompt");
        writeToEditor('```json\n' + (e as Error).toString() + '\n```');
        return;
    }
});