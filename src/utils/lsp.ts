import { commands, window, workspace } from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    TransportKind,
} from "vscode-languageclient/node";

const dockerrunner = {
    command: "docker",
    transport: TransportKind.stdio,
    args: [
        "run",
        "--init",
        "--pull",
        "always",
        "--interactive",
        "--rm",
        "-v", "/var/run/docker.sock:/var/run/docker.sock",
        "--mount",
        "type=volume,source=docker-lsp,target=/docker",
        "-l",
        `com.docker.lsp.workspace_roots=${(workspace.workspaceFolders || []).map(f => f.uri.fsPath).join(",")}`,
        "-l",
        'com.docker.lsp=true',
        "-l",
        'com.docker.lsp.extension=labs-ai-tools-vscode',
        "docker/lsp",
        "--workspace",
        "/docker",
        "--profile",
        "labs-ai-tools-vscode",
    ],
};

const clientOptions: LanguageClientOptions = {
    documentSelector: [
        { language: "markdown", scheme: "file" },
    ],
    progressOnInitialization: true,
    outputChannel: window.createOutputChannel("Docker LSP (Markdown)"),
    revealOutputChannelOn: 4,
};

const serverOptions = {
    run: dockerrunner,
    debug: dockerrunner,
};

export const nativeClient = new LanguageClient(
    "dockerMarkdownLanguageClient",
    "Docker LSP Markdown Client",
    serverOptions,
    clientOptions
);