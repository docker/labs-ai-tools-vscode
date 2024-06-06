import * as vscode from "vscode";
import { workspaceCommands } from "../extension";

const groupCommands = (blocks: (typeof workspaceCommands)[string]) => blocks.reduce((acc, { command, script }) => {
    if (!acc[command]) {
        acc[command] = '';
    }
    acc[command] += script;
    return acc;
}, {} as Record<string, string>);

export const runHotCommand = async () => {
    const quickPicks = [];
    if (Object.keys(workspaceCommands).length === 0) {
        return vscode.window.showErrorMessage('No runbooks found in workspace');
    }
    for (const [runbookFSPath, blocks] of Object.entries(workspaceCommands)) {
        quickPicks.push({
            label: runbookFSPath,
            description: ``,
            detail: ``,
            kind: vscode.QuickPickItemKind.Separator,
            workspace: runbookFSPath,
        });

        const groupedBlocks = groupCommands(blocks);

        quickPicks.push(...Object.entries(groupedBlocks).map(([command, script]) => ({
            label: command,
            detail: script,
            workspace: runbookFSPath,
        })));
    };

    void vscode.window.showQuickPick(quickPicks).then((tag) => {
        if (!tag) {
            return;
        }

        const terminalIdentifier = `${tag.label}-${tag.workspace}`;

        const existingTerminal = vscode.window.terminals.find(
            terminal => terminal.name === terminalIdentifier
        );

        const terminal = existingTerminal || vscode.window.createTerminal(terminalIdentifier);

        terminal.sendText(tag.detail);
        terminal.show();
    });
};
