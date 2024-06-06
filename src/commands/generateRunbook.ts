import {
    spawnSync,
} from "child_process";
import { TextEncoder } from "util";
import * as vscode from "vscode";
import OpenAI from 'openai';
import { prepareProjectPrompt, getPromptTypes } from "../utils/preparePrompt";
import { verifyHasOpenAIKey } from "../extension";

// Must match package.json contributed configuration
const ENDPOINT_ENUM_MAP = {
    OpenAI: "https://api.openai.com/v1",
    Ollama: "http://localhost:11434/v1"
};

const prepareRunbookFile = async (workspaceFolder: vscode.WorkspaceFolder, promptType: string) => {
    const uri = vscode.Uri.file(
        workspaceFolder.uri.fsPath + `/runbook.${promptType}.md`
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

export const generateRunbook = (secrets: vscode.SecretStorage) => vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async progress => {

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


    if (vscode.workspace.getConfiguration('docker.make-runbook').get('openai-base') === 'OpenAI') {
        await verifyHasOpenAIKey(secrets, true);
    }

    const promptTypes = getPromptTypes();

    const promptOption = await vscode.window.showQuickPick(promptTypes.map(f => ({ label: f.title, detail: f.title, index: f.type })), { title: "Select prompt type", ignoreFocusOut: true });

    let apiKey = await secrets.get("openAIKey");

    const { editor, doc } = (await prepareRunbookFile(workspaceFolder, promptOption!.index) || {});

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

        progress.report({ increment: 5, message: "Starting LLM ..." });

        const openai = new OpenAI({
            apiKey,
            baseURL: ENDPOINT_ENUM_MAP[(await vscode.workspace.getConfiguration("docker.make-runbook").get("openai-base") as 'Ollama' | 'OpenAI')]
        });

        progress.report({ increment: 5, message: "Preparing payload..." });

        const messages = prepareProjectPrompt(workspaceFolder, authPayload.Username, promptOption!.index);

        progress.report({ increment: 5, message: "Calling LLM..." });

        const model = await vscode.workspace.getConfiguration("docker.make-runbook").get("openai-model") as string;

        const completionStream = await openai.chat.completions.create({
            messages,
            model,
            stream: true
        });

        progress.report({ increment: 5, message: `Streaming ${model}` });

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
        void vscode.window.showErrorMessage("Error generating runbook");
        await editor.edit((edit) => {
            edit.insert(
                new vscode.Position(editor.document.lineCount, 0),
                '```json\n' + (e as Error).toString() + '\n```'
            );
        });
        return;
    }
});

