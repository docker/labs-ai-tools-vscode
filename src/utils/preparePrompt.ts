import { spawnSync } from "child_process";
import * as vscode from "vscode";

type PromptTypes = [{ title: string, type: string }];

export const getPromptTypes = function (): PromptTypes {
    // github:docker/labs-make-runbook?ref=main&path=prompts/docker
    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    if (promptImage === "vonwig/prompts" || promptImage === "vonwig/prompts:latest") {
        spawnSync('docker', ['pull', "vonwig/prompts"]);
    }
    const result = spawnSync('docker', ['run', promptImage, "prompts"]);
    try {
        return JSON.parse(result.stdout.toString());
    }
    catch (e) {
        throw new Error(`Expected JSON from ${promptImage}, got STDOUT: ${result.stdout.toString()} STDERR: ${result.stderr.toString()} ERR: ${(result.error || "N/A").toString()}`);
    }

};

export const prepareProjectPrompt = (projectRoot: vscode.WorkspaceFolder, username: string, promptType: string) => {

    const platform = process.platform;

    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;

    const promptImageArgs = ['run', '--rm', "-v", "/var/run/docker.sock:/var/run/docker.sock", "--mount", "type=volume,source=docker-prompts,target=/prompts", promptImage, projectRoot.uri.fsPath, username, platform, promptType];

    const result = spawnSync('docker', promptImageArgs);

    if (result.error) {
        throw result.error;
    }
    try {
        return JSON.parse(result.stdout.toString());
    }
    catch (e) {
        throw new Error(`Expected JSON from ${promptImage}, got STDOUT: ${result.stdout.toString()} STDERR: ${result.stderr.toString()} ERR: ${(result.error || "N/A").toString()}`);
    }
};
