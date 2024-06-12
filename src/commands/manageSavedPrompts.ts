import { spawnSync } from 'child_process';
import * as vscode from 'vscode';
import { showPromptPicker } from '../utils/promptPicker';

export const savePrompt = async (prompt: string) => {
    if (!prompt) {
        prompt = (await showPromptPicker())?.id || "";
    }
    if (prompt === "") {
        return;
    }

    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    const args = [
        "run",
        "--rm",
        promptImage,
        "register",
        prompt
    ];
    const result = spawnSync('docker', args);
};

export const deletePrompt = (prompt: string) => {
    const promptImage = vscode.workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    const args = [
        "run",
        "--rm",
        promptImage,
        "unregister",
        prompt
    ];
    const result = spawnSync('docker', args);
};