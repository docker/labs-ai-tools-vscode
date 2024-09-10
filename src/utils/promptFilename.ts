import path from "path";
import * as vscode from "vscode";

export const generateFriendlyPromptName = (promptType: string) => {
    let friendlyPromptName = promptType;

    if (friendlyPromptName.startsWith("github:")) {
        const repo = friendlyPromptName.split("github:")[1].split("?")[0].replace("/", "-");
        const path = friendlyPromptName.split("path=")[1].split("&")[0].replaceAll("/", "-");
        friendlyPromptName = `${repo}-${path || 'root'}`;
    }
    else if (friendlyPromptName.startsWith("local:")) {
        const delim = process.platform === "win32" ? "\\" : "/";
        friendlyPromptName = friendlyPromptName.split("local://")[1].split(delim).reverse()[0];
        friendlyPromptName = 'local-' + friendlyPromptName;
    }
    return friendlyPromptName;
};

export const createOutputBuffer = async (workspaceFolder: vscode.WorkspaceFolder | undefined, promptType: string) => {

    const friendlyPromptName = generateFriendlyPromptName(promptType);

    const uri = vscode.Uri.file(
        (
            workspaceFolder?.uri.fsPath
            ||
            path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath!)
        ) + `/${friendlyPromptName}.md`.replace('.md.md', '.md')
    );

    try {
        await vscode.workspace.fs.stat(uri);
        const option = await vscode.window.showQuickPick([{ label: "Append" }, { label: "Overwrite", detail: `Will delete ${uri.fsPath}` }, { label: "Cancel" }], {
            title: "Output for this prompt already exists",
            ignoreFocusOut: true,
        });
        if (!option || option.label === "Cancel") {
            return;
        }
        if (option.label === "Overwrite") {
            const edit = new vscode.WorkspaceEdit();
            const startPosition = new vscode.Position(0, 0);
            const endPosition = new vscode.Position(1000000, 0);
            // Strip contents of file
            edit.replace(uri, new vscode.Range(startPosition, endPosition), "");
            await vscode.workspace.applyEdit(edit);
        }
        else {
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(""));
        }
    }
    catch (e) {
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri);
        await vscode.workspace.applyEdit(edit);
    }

    const doc = await vscode.workspace.openTextDocument(uri);

    const editor = await vscode.window.showTextDocument(doc);

    return { editor, doc };
};