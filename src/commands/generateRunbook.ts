import {
    spawnSync,
} from "child_process";
import { TextEncoder } from "util";
import * as vscode from "vscode";
import OpenAI from 'openai';
import { prepareProjectPrompt } from "../utils/preparePrompt";
import { dockerLSP } from "../extension";

const prepareRunbookFile = async (workspaceFolder: vscode.WorkspaceFolder) => {
    const uri = vscode.Uri.file(
        workspaceFolder.uri.fsPath + "/runbook.md"
    );

    try {
        await vscode.workspace.fs.stat(uri);
        const option = await vscode.window.showQuickPick([{ label: "Do nothing" }, { label: "Overwrite", detail: `Will delete ${uri.fsPath}` }], {
            title: "Runbook already exists",
            ignoreFocusOut: true,
        });
        if (!option || option.label === "Do nothing") {
            return;
        }
        if (option.label === "Overwrite") {
            await vscode.workspace.fs.delete(uri);
        }
    }
    catch (e) {
        // File does not exist
    }

    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(""));

    const doc = await vscode.workspace.openTextDocument(uri);

    const editor = await vscode.window.showTextDocument(doc);

    return { editor, doc };
};

export const generateRunbook = () => vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async progress => {

    progress.report({ increment: 0, message: "Starting..." });

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return vscode.window.showErrorMessage("No workspace open");
    }

    let workspaceFolder = workspaceFolders[0];

    if (workspaceFolders.length > 1) {
        // Multi-root workspace support WIP
        const option = await vscode.window.showQuickPick(workspaceFolders.map(f => ({ label: f.name, detail: f.uri.fsPath, index: f.index })), {
            title: "Select workspace",
            ignoreFocusOut: true,
        });
        if (!option) {
            return vscode.window.showErrorMessage("No workspace selected");
        }
        workspaceFolder = workspaceFolders[option.index];
    }

    const apiKey = vscode.workspace.getConfiguration("docker.make-runbook").get("openai") as string;

    if (!apiKey) {
        const result = await vscode.window.showErrorMessage("OpenAI API key not set. Please set it in the settings.", { modal: true }, "Edit setting");
        if (result === "Edit setting") {
            await vscode.commands.executeCommand("workbench.action.openSettings", 'docker.make-runbook.openai');
        }
        return;
    }

    const { editor, doc } = (await prepareRunbookFile(workspaceFolder) || {});

    if (!editor || !doc) {
        return;
    }

    progress.report({ increment: 5, message: "Detecting docker desktop token" });

    try {
        const auth = spawnSync(
            `echo "https://index.docker.io/v1//access-token" | docker-credential-desktop get`,
            {
                shell: true,
            }
        );

        const authPayload = JSON.parse(auth.stdout.toString()) as {
            "ServerURL": string,
            "Username": string,
            "Secret": string
        };

        progress.report({ increment: 15, message: "Analyzing project" });

        const facts = await dockerLSP.sendRequest("docker/project-facts");

        progress.report({ increment: 5, message: "Generating..." });



        const openai = new OpenAI({
            apiKey,
        });

        let completionStream;

        try {
            completionStream = await openai.chat.completions.create({
                messages: prepareProjectPrompt(facts, authPayload.Username),
                model: 'gpt-4',
                stream: true
            });
        }
        catch (e) {
            const message = (e as Error).message;
            if (message && message.startsWith('403')) {
                return vscode.window.showErrorMessage('You need to log in to Docker Desktop to use this extension.', { modal: true });
            }
            throw e;
        }

        for await (const chunk of completionStream) {
            await editor.edit((edit) => {
                edit.insert(
                    new vscode.Position(editor.document.lineCount, 0),
                    chunk.choices[0].delta.content || ""
                );
            });
        }
        await doc.save();
    } catch (e: unknown) {
        void editor.edit((edit) => {
            edit.insert(
                new vscode.Position(editor.document.lineCount, 0),
                '```json\n' + (e as Error).toString() + '\n```'
            );
        });
    }
});

