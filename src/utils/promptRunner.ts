import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { CancellationToken, commands, window, workspace } from "vscode";
import { setThreadId } from "../commands/setThreadId";
import { notifications } from "./notifications";
import { extensionOutput } from "../extension";
import * as rpc from 'vscode-jsonrpc/node';
import path from "path";

const activePrompts: { [key: string]: Function } = {};

export const sendKillSignalToActivePrompts = () =>
    Object.values(activePrompts).map(kill => kill());


export const getRunArgs = async (promptRef: string, projectDir: string, username: string, pat: string, platform: string, render = false) => {
    const isLocal = promptRef.startsWith('local://');
    const isMarkdown = promptRef.toLowerCase().endsWith('.md');
    const threadId = await commands.executeCommand<ReturnType<typeof setThreadId>>('docker.labs-ai-tools-vscode.thread-id', false)
    let promptArgs: string[] = ["--prompts", promptRef];
    let mountArgs: string[] = ["--mount", `type=bind,source=${projectDir},target=/app/${promptRef}`];

    if (isLocal) {
        const localPromptPath = promptRef.replace('local://', '');
        const localPromptDirPath = path.dirname(localPromptPath);
        const localPromptDirName = path.basename(localPromptDirPath);
        const pathSeparator = platform === 'win32' ? '\\' : '/';
        // Basically the markdown file name eg `prompt.md`
        promptRef = path.basename(localPromptPath);
        promptArgs = [isMarkdown ? "--prompts-dir" : "--prompts-file", `/app/${localPromptDirName}/${promptRef}`];
        mountArgs = ["--mount", `type=bind,source=${localPromptDirPath},target=/app/${localPromptDirName}`];
    }

    const baseArgs: string[] = [
        'run',
        '--rm',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', 'openai_key:/secret',
        '--mount', 'type=volume,source=docker-prompts,target=/prompts',
        '-e', 'OPENAI_API_KEY_LOCATION=/secret',
        '-v', "/run/host-services/backend.sock:/host-services/docker-desktop-backend.sock",
        '-e', "DOCKER_DESKTOP_SOCKET_PATH=/host-services/docker-desktop-backend.sock",
    ];

    const runArgs: string[] = render ? [] : [
        'vonwig/prompts:latest',
        ...(render ? [] : ['run']),
        "--host-dir", projectDir,
        "--user", username,
        "--platform", platform,
        ...promptArgs,
        '--jsonrpc',
        ...(pat ? ['--pat', pat] : []),
        ...(threadId ? ['--thread-id', threadId] : []),
    ];

    return [...baseArgs, ...mountArgs, ...runArgs];
};

export const spawnPromptImage = async (promptArg: string, projectDir: string, username: string, platform: string, pat: string, callback: (json: any) => Promise<void>, token: CancellationToken) => {
    const args = await getRunArgs(promptArg!, projectDir!, username, platform, pat);
    callback({ method: 'message', params: { debug: `Running ${args.join(' ')}` } });
    const childProcess = spawn("docker", args);
    const pid = childProcess.pid;

    if (pid) {
        activePrompts[pid] = childProcess.kill;
        childProcess.on('exit', () => {
            delete activePrompts[pid];
        });
    }

    let connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(childProcess.stdout),
        new rpc.StreamMessageWriter(childProcess.stdin)
    );
    const notificationBuffer: { method: string, params: object }[] = []

    let processingBuffer = false;

    const processBuffer = async () => {
        processingBuffer = true;
        while (notificationBuffer.length > 0) {
            await callback(notificationBuffer.shift());
        }
        processingBuffer = false;
    }


    const pushNotification = (method: string, params: object) => {
        notificationBuffer.push({ method, params });
        if (!processingBuffer) {
            processBuffer();
        }
    }

    for (const [type, properties] of Object.entries(notifications)) {
        // @ts-expect-error
        connection.onNotification(properties, (params) => pushNotification(type, params))
    }

    connection.listen();

    token.onCancellationRequested(() => {
        childProcess.kill();
        connection.dispose();
    });

    return new Promise<void>((resolve) => {
        childProcess.on('exit', () => {
            resolve();
        });
    });

};

const getJSONArgForPlatform = (json: object) => {
    if (process.platform === 'win32') {
        return `"` + JSON.stringify(json).replace(/"/g, '\\"') + `"`
    }
    else {
        return `'` + JSON.stringify(json) + `'`
    }
}

export const writeKeyToVolume = async (key: string) => {

    const args1 = ["pull", "vonwig/function_write_files"];

    const args2 = [
        "run",
        "-v", "openai_key:/secret",
        "--rm",
        "--workdir", "/secret",
        "vonwig/function_write_files",
        getJSONArgForPlatform({ files: [{ path: ".openai-api-key", content: key, executable: false }] })
    ];

    extensionOutput.appendLine(JSON.stringify({
        "write-open-ai-key-to-volume": {
            args1, args2
        }
    }));

    const child1 = spawn("docker", args1);

    child1.stdout.on('data', (data) => {
        extensionOutput.appendLine(JSON.stringify({ stdout: data.toString() }));
    });
    child1.stderr.on('data', (data) => {
        extensionOutput.appendLine(JSON.stringify({ stderr: data.toString() }));
    });

    const child2 = spawn("docker", args2, {
        shell: true
    });
    child2.stdout.on('data', (data) => {
        extensionOutput.appendLine(JSON.stringify({ stdout: data.toString() }));
    });
    child2.stderr.on('data', (data) => {
        extensionOutput.appendLine(JSON.stringify({ stderr: data.toString() }));
    });
};