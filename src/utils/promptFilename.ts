import * as vscode from "vscode";

export const generateFriendlyPromptName = (promptType: string) => {
    let friendlyPromptName = promptType;

    if (friendlyPromptName.startsWith("github:")) {
        const repo = friendlyPromptName.split("github:")[1].split("?")[0].replace("/", "-");
        const path = friendlyPromptName.split("path=")[1].split("&")[0].replaceAll("/", "-");
        friendlyPromptName = `gh-${repo}-${path || 'root'}`;
    }

    return friendlyPromptName;
};

export const preparePromptFile = async (workspaceFolder: vscode.WorkspaceFolder, promptType: string) => {

    const friendlyPromptName = generateFriendlyPromptName(promptType);

    const uri = vscode.Uri.file(
        workspaceFolder.uri.fsPath + `/prompt-resp-${friendlyPromptName}.md`
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
            await vscode.workspace.fs.delete(uri);
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