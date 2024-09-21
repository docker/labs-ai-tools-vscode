import { spawn } from "child_process";
import { commands, window, workspace } from "vscode";
import { setThreadId } from "../commands/setThreadId";
const output = window.createOutputChannel("Docker Labs: AI Tools");

export const getRunArgs = async (promptRef: string, projectDir: string, username: string, platform: string, pat: string, render = false) => {
    const isLocal = promptRef.startsWith('local://');
    const isMarkdown = promptRef.toLowerCase().endsWith('.md');
    const threadId = await commands.executeCommand<ReturnType<typeof setThreadId>>('docker.labs-ai-tools-vscode.thread-id', false)
    let promptArgs: string[] = ["--prompts", promptRef];
    let mountArgs: string[] = ["--mount", `type=bind,source=${projectDir},target=/app/${promptRef}`];

    if (isLocal) {
        const localPromptPath = promptRef.replace('local://', '');
        const pathSeparator = platform === 'win32' ? '\\' : '/';
        promptRef = localPromptPath.split(pathSeparator).pop() || 'unknown-local-prompt';
        promptArgs = [isMarkdown ? "--prompts-dir" : "--prompts-file", `/app/${promptRef}`];
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
        ...(pat ? ['--pat', pat] : []),
        ...(threadId ? ['--thread-id', threadId] : []),
    ];

    return [...baseArgs, ...mountArgs, ...runArgs];
};

const anonymizePAT = (args: string[]) => {
    if (!args.includes('--pat')) {
        return args
    }
    const patIndex = args.indexOf('--pat')
    const newArgs = [...args]
    newArgs[patIndex + 1] = args[patIndex + 1].slice(0, 10) + '****'
    return newArgs
}

const runAndStream = async (command: string, args: string[], callback: (json: any) => Promise<any>) => {
    // const argsWithPrivatePAT = anonymizePAT(args)
    // output.appendLine(`Running ${command} with args ${argsWithPrivatePAT.join(' ')}`);
    const child = spawn(command, args);
    let out: any[] = [];
    let processing = false
    const processSTDOUT = async (callback: (json: {}) => Promise<void>) => {
        processing = true
        while (out.length) {
            const last = out.pop()
            let json;
            try {
                json = JSON.parse(last);
            } catch (e) {
                console.error(`Failed to parse JSON: ${last}, ${e}`);
                child.kill();
            }
            await callback(json);
        }
        processing = false;
    }

    const onChildSTDIO = async ({ stdout, stderr }: { stdout: string; stderr: string | null }) => {
        if (stdout && stdout.startsWith('Content-Length:')) {
            out.push(stdout.split('Content-Length: ').filter(Boolean).map(rpcMessage => rpcMessage.trim().slice(rpcMessage.indexOf('{'))))
        }
        if (!processing && out.length) {
            processSTDOUT(callback)
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

export const spawnPromptImage = async (promptArg: string, projectDir: string, username: string, platform: string, pat: string, callback: (json: any) => Promise<void>) => {
    const args = await getRunArgs(promptArg!, projectDir!, username, platform, pat);
    callback({ method: 'message', params: { debug: `Running ${args.join(' ')}` } });
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
    const callback = async (json: any) => {
        output.appendLine(JSON.stringify(json, null, 2));
    };
    await runAndStream("docker", args1, callback);
    await runAndStream("docker", args2, callback);
};