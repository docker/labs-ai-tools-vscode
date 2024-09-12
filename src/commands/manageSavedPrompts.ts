import * as vscode from 'vscode';
import { showPromptPicker } from '../utils/promptPicker';
import { ctx } from '../extension';



export const savePrompt = async (prompt: string) => {
    if (!prompt) {
        prompt = (await showPromptPicker())?.id || "";
    }
    if (prompt === "") {
        return vscode.window.showErrorMessage("No prompt selected");
    }
    else {
        ctx.globalState.update('savedPrompts', [...ctx.globalState.get('savedPrompts', []), prompt]);
        vscode.window.showInformationMessage(`Saved ${prompt}`);
        vscode.commands.executeCommand("docker.labs-ai-tools-vscode.run-prompt");
    }
};

export const deletePrompt = (prompt: string) => {
    ctx.globalState.update('savedPrompts', ctx.globalState.get('savedPrompts', []).filter(p => p !== prompt));
    vscode.window.showInformationMessage(`Deleted ${prompt}`);
    vscode.commands.executeCommand("docker.labs-ai-tools-vscode.run-prompt");
};
