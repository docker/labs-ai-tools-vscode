import { spawnSync } from 'child_process';
import * as vscode from 'vscode';
import { showPromptPicker } from '../utils/promptPicker';

export const savePrompt = async (prompt: string) => {
    if (!prompt) {
        prompt = (await showPromptPicker(true))?.id || "";
    }
    if (prompt === "") {
        return vscode.window.showErrorMessage("No prompt selected");
    }

    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    const args = [
        "run",
        "--rm",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        "--mount",
        "type=volume,source=docker-prompts,target=/prompts",
        promptImage,
        "register",
        prompt
    ];
    const result = spawnSync('docker', args);
    if (result.error || result.status !== 0) {
        vscode.window.showErrorMessage(`Error saving prompt ${prompt}: ${result.error || result.stderr.toString()}`);
    }
    else {
        vscode.window.showInformationMessage(`Saved ${prompt}`);
        vscode.commands.executeCommand("docker.make-runbook.generate");
    }
};

export const deletePrompt = (prompt: string) => {
    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    const args = [
        "run",
        "--rm",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        "--mount",
        "type=volume,source=docker-prompts,target=/prompts",
        promptImage,
        "unregister",
        prompt
    ];
    const result = spawnSync('docker', args);
    if (result.error || result.status !== 0) {
        vscode.window.showErrorMessage(`Error deleting prompt ${prompt}: ${result.error || result.stderr.toString()}`);
    }
    else {
        vscode.window.showInformationMessage(`Deleted ${prompt}`);
        vscode.commands.executeCommand("docker.make-runbook.generate");
    }
};