import * as vscode from "vscode";

export const createOutputBuffer = async (fileName: string, hostDir: string) => {
    const edit = new vscode.WorkspaceEdit();

    const newURI = vscode.Uri.file(`${hostDir}/${fileName}`);

    edit.createFile(newURI, { ignoreIfExists: true });

    await vscode.workspace.applyEdit(edit);

    const doc = await vscode.workspace.openTextDocument(newURI);

    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

    return { editor, doc };
};