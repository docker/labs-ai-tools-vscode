import {
    spawnSync,
} from "child_process";
import { TextEncoder } from "util";
import * as vscode from "vscode";
import OpenAI from 'openai';
import { prepareProjectPrompt } from "../utils/preparePrompt";
import { verifyHasOpenAIKey } from "../extension";
import { showPromptPicker } from "../utils/promptPicker";

// Must match package.json contributed configuration
const ENDPOINT_ENUM_MAP = {
    OpenAI: "https://api.openai.com/v1",
    Ollama: "http://localhost:11434/v1"
};

const DEFAULT_USER = "local-user";

const prepareRunbookFile = async (workspaceFolder: vscode.WorkspaceFolder, promptType: string) => {

    let friendlyPromptName = promptType;

    if (friendlyPromptName.startsWith("github:")) {
        const repo = friendlyPromptName.split("github:")[1].split("?")[0].replace("/", "-");
        const path = friendlyPromptName.split("path=")[1].split("&")[0].replaceAll("/", "-");
        friendlyPromptName = `gh-${repo}:${path}`;
    }

    const uri = vscode.Uri.file(
        workspaceFolder.uri.fsPath + `/runbook.${friendlyPromptName}.md`
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
    // Check docker command exists
    try {
        const res = spawnSync("docker", ["--version"]);
        if (res.error) {
            throw res.error;
        }
    } catch (e) {
        return vscode.window.showErrorMessage("Docker not found", { modal: true }, "Install Docker Desktop").then((value) => {
            if (value === "Install Docker Desktop") {
                vscode.env.openExternal(vscode.Uri.parse("https://www.docker.com/products/docker-desktop"));
            }
        });
    }

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

    const promptOption = await showPromptPicker();

    if (!promptOption) {
        return;
    }

    let apiKey = await secrets.get("openAIKey");

    const { editor, doc } = (await prepareRunbookFile(workspaceFolder, promptOption.id) || {});

    if (!editor || !doc) {
        return;
    }

    progress.report({ increment: 5, message: "Detecting docker desktop token" });

    try {
        const auth = spawnSync(
            `echo "https://index.docker.io/v1//access-token" | docker-credential-desktop get`,
            {
                shell: process.platform === 'win32' ? "powershell" : true,
            }
        );

        let Username = DEFAULT_USER;

        if (auth.stdout.toString().startsWith("{") && auth.status === 0 && !auth.error) {
            try {
                const authPayload = JSON.parse(auth.stdout.toString()) as {
                    "ServerURL": string,
                    "Username": string,
                    "Secret": string
                };
                Username = authPayload.Username;
            }
            catch (e) {
                throw new Error(`Expected JSON from docker-credential-desktop, got STDOUT: ${auth.stdout.toString()} STDERR: ${auth.stderr.toString()} ERR: ${(auth.error || "N/A").toString()}`);
            }

        }

        progress.report({ increment: 5, message: "Starting LLM ..." });

        const openai = new OpenAI({
            apiKey: apiKey || '',
            baseURL: ENDPOINT_ENUM_MAP[(await vscode.workspace.getConfiguration("docker.make-runbook").get("openai-base") as 'Ollama' | 'OpenAI')]
        });

        progress.report({ increment: 5, message: "Preparing payload..." });

        const messages = prepareProjectPrompt(workspaceFolder, Username, promptOption.id);

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
        e = e as Error;
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