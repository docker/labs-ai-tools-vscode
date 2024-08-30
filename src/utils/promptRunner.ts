import { spawn } from "child_process";
import { window } from "vscode";
const output = window.createOutputChannel("Docker Labs: AI Tools");

export const getRunArgs = (promptRef: string, projectDir: string, username: string, platform: string, pat: string, render = false) => {
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
        '-v', 'openai_key:/secret',
        '--mount', 'type=volume,source=docker-prompts,target=/prompts',
        '-e', 'OPENAI_API_KEY_LOCATION=/secret',
    ];

    const runArgs: string[] = render ? [] : [
        'vonwig/prompts:latest',
        ...(render ? [] : ['run']),
        "--host-dir", projectDir,
        "--user", username,
        "--platform", platform,
        ...promptArgs,
        '--jsonrpc',
        ...(pat ? ['--pat', pat] : [])
    ];
    return [...baseArgs, ...mountArgs, ...runArgs];
};

const runAndStream = async (command: string, args: string[], callback: (json: any) => void) => {
    output.appendLine(`Running ${command} with args ${args.join(' ')}`);
    const child = spawn(command, args);

    const onChildSTDIO = ({ stdout, stderr }: { stdout: string; stderr: string | null }) => {
        if (stdout && stdout.startsWith('Content-Length:')) {

            const rpcMessages = stdout.split('Content-Length: ').filter(Boolean).map(rpcMessage => rpcMessage.trim().slice(rpcMessage.indexOf('{')));

            for (const rpcMessage of rpcMessages) {
                let json;
                try {
                    json = JSON.parse(rpcMessage);
                } catch (e) {
                    console.error(`Failed to parse JSON: ${rpcMessage}, ${e}`);
                    child.kill();
                }
                callback(json);


            }
        }
        else if (stderr) {
            callback({ method: 'error', params: { content: stderr } });
        }
        else {
            callback({ method: 'message', params: { content: stdout } });
        }
    };
    return new Promise((resolve, reject) => {
        child.stdout.on('data', (data) => {
            onChildSTDIO({ stdout: data.toString(), stderr: '' });
        });
        child.stderr.on('data', (data) => {
            onChildSTDIO({ stderr: data.toString(), stdout: '' });
        });
        child.on('close', (code) => {
            callback({ method: 'message', params: { debug: `child process exited with code ${code}` } });
            resolve(code);
        });
        child.on('error', (err) => {
            callback({ method: 'error', params: { content: JSON.stringify(err) } });
            reject(err);
        });
    });
};

export const spawnPromptImage = async (promptArg: string, projectDir: string, username: string, platform: string, pat: string, callback: (json: any) => void) => {
    const args = getRunArgs(promptArg!, projectDir!, username, platform, pat);
    return runAndStream("docker", args, callback);
};

export const writeKeyToVolume = async (key: string) => {

    const args1 = ["pull", "vonwig/function_write_files"];
    const args2 = [
        "run",
        "-v",
        "openai_key:/secret",
        "--workdir", "/secret",
        "vonwig/function_write_files",
        `'` + JSON.stringify({ files: [{ path: ".openai-api-key", content: key, executable: false }] }) + `'`
    ];
    const callback = (json: any) => {
        output.appendLine(JSON.stringify(json, null, 2));
    };
    await runAndStream("docker", args1, callback);
    await runAndStream("docker", args2, callback);
};