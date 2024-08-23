import { spawn } from "child_process";
import { window } from "vscode";

export const getRunArgs = (promptRef: string, projectDir: string, username: string, platform: string, render = false) => {
    const isLocal = promptRef.startsWith('local://');
    let promptArgs: string[] = ["--prompts", promptRef];
    let mountArgs: string[] = [];

    if (isLocal) {
        const localPromptPath = promptRef.replace('local://', '');
        const pathSeparator = platform === 'win32' ? '\\' : '/';
        promptRef = localPromptPath.split(pathSeparator).pop() || 'unknown-local-prompt';
        promptArgs = ["--prompts-dir", `/app/${promptRef}`];
        mountArgs = ["--mount", `type=bind,source=${localPromptPath},target=/app/${promptRef}`];
    }

    const baseArgs: string[] = [
        'run',
        '--rm',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', 'openai_key:/root',
        '--mount', 'type=volume,source=docker-prompts,target=/prompts'
    ];

    const runArgs: string[] = render ? [] : [
        'vonwig/prompts:latest',
        ...(render ? [] : ['run']),
        "--host-dir", projectDir,
        "--user", username,
        "--platform", platform,
        ...promptArgs,
        '--jsonrpc'
    ];

    return [...baseArgs, ...mountArgs, ...runArgs];
};

const runAndStream = async (command: string, args: string[], callback: (json: any) => void) => {
    const child = spawn(command, args);

    const onOutput = ({ stdout, stderr }: { stdout: string; stderr: string | null }) => {
        if (stdout && stdout.startsWith('{')) {
            let rpcMessage = stdout.split('}Content-Length:')[0];
            if (!rpcMessage.endsWith('}}')) {
                rpcMessage += '}';
            }
            const json = JSON.parse(rpcMessage);
            callback(json);
        }
        if (stderr) {
            callback({ method: 'message', params: { debug: stderr } });
        }
    };

    return new Promise((resolve, reject) => {
        child.stdout.on('data', (data) => {
            onOutput({ stdout: data.toString(), stderr: '' });
        });
        child.stderr.on('data', (data) => {
            onOutput({ stderr: data.toString(), stdout: '' });
        });
        child.on('close', (code) => {
            callback({ method: 'message', params: { debug: `child process exited with code ${code}` } });
            resolve(code);
        });
        child.on('error', (err) => {
            callback({ method: 'error', params: { content: err } });
            reject(err);
        });
    });
};

export const spawnPromptImage = async (promptArg: string, projectDir: string, username: string, platform: string, callback: (json: any) => void) => {
    const args = getRunArgs(promptArg!, projectDir!, username, platform);
    return runAndStream("docker", args, callback);
};

export const writeKeyToVolume = async (key: string) => {
    const output = window.createOutputChannel("Docker Labs: AI Tools");
    const args1 = ["pull", "vonwig/function_write_files"];
    const args2 = [
        "run",
        "-v",
        "openai_key:/root",
        "--workdir", "/root",
        "vonwig/function_write_files",
        `'` + JSON.stringify({ files: [{ path: ".openai-api-key", content: key, executable: false }] }) + `'`
    ];
    const callback = (json: any) => {
        output.appendLine(JSON.stringify(json, null, 2));
    };
    await runAndStream("docker", args1, callback);
    await runAndStream("docker", args2, callback);
};