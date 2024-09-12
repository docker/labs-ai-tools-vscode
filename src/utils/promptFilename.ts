import * as vscode from "vscode";

export const createOutputBuffer = async () => {
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown' });

    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

    return { editor, doc };
};