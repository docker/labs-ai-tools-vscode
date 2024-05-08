import * as vscode from "vscode";
import { workspaceCommands } from "../extension";

export const runHotCommand = async () => {
    if (!vscode.workspace.workspaceFolders) {
        return vscode.window.showErrorMessage("No workspace open.");
    }

    let workspace = vscode.workspace.workspaceFolders[0];

    if (vscode.window.activeTextEditor) {
        workspace = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri) || workspace;
    }

    const commands: { command: string; script: string }[] =
        workspaceCommands[`docker-run-${workspace.uri.fsPath}`] || [];

    if (!commands || commands.length === 0) {
        vscode.window.showErrorMessage("No commands bound to workspace");
        return;
    }

    // Combines commands with mathcing names
    const combinedCommands = commands.reduce(
        (acc: { [key: string]: string }, { command, script }) => {
            if (acc[command]) {
                acc[command] += `\n${script}`;
            } else {
                acc[command] = script;
            }
            return acc;
        },
        {}
    ) as { [key: string]: string };

    const quickPicks = Object.entries(combinedCommands).map(
        ([tag, command]) => ({
            label: tag,
            description: `Run ${command.split("\n").length} command(s)`,
            detail: command,
        })
    );

    void vscode.window.showQuickPick(quickPicks).then((tag) => {
        if (!tag) {
            return;
        }

        const terminalIdentifier = vscode.workspace.workspaceFolders!.length > 1 ? `[${workspace.name}]-${tag.label}` : tag.label;

        const existingTerminal = vscode.window.terminals.find(
            terminal => terminal.name === terminalIdentifier
        );

        const terminal = existingTerminal || vscode.window.createTerminal(terminalIdentifier);

        terminal.sendText(tag.detail);
        terminal.show();
    });
};