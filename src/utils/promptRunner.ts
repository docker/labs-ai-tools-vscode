import { spawn } from "child_process";

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

export const spawnPromptImage = async (promptArg: string, projectDir: string, username: string, platform: string, callback: (json: any) => void) => {

    const args = getRunArgs(promptArg!, projectDir!, username, platform);

    const child = spawn("run", args);

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
            onOutput({ stdout: data, stderr: '' });
        });
        child.stderr.on('data', (data) => {
            onOutput({ stderr: data, stdout: '' });
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