import { spawnSync } from "child_process";
import * as vscode from "vscode";

type PromptTypes = [{ title: string, type: string }];

export const getPromptTypes = function (): PromptTypes {
    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    if (promptImage === "vonwig/prompts") {
        spawnSync('docker', ['pull', "vonwig/prompts"]);
    }
    const result = spawnSync('docker', ['run', '--rm', promptImage, "prompts"]);
    return JSON.parse(result.stdout.toString());
};

export const prepareProjectPrompt = (projectRoot: vscode.WorkspaceFolder, username: string, promptType: string) => {

    const platform = process.platform;

    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;

    vscode.window.showInformationMessage(['run', '--rm', "-v", "/var/run/docker.sock:/var/run/docker.sock", promptImage, projectRoot.uri.fsPath, username, JSON.stringify(platform), promptType].join(','))
    const result = spawnSync('docker', ['run', '--rm', "-v", "/var/run/docker.sock:/var/run/docker.sock", promptImage, projectRoot.uri.fsPath, username, JSON.stringify(platform), promptType]);

    if (result.error) {
        throw result.error;
    }

    return JSON.parse(result.stdout.toString());
};
