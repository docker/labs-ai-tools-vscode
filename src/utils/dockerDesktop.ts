import { spawnSync } from "child_process";
import * as vscode from "vscode";

const START_DOCKER_COMMAND = {
    'win32': 'Start-Process -NoNewWindow -Wait -FilePath "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"',
    'darwin': 'open -a Docker',
    'linux': 'systemctl --user start docker-desktop',
};

export const checkDockerDesktop = () => {

    // Coerce the error to have an exit code
    type DockerSpawnError = Error & { code: number };

    try {
        const res = spawnSync("docker", ["version"]);

        if (res.error) {
            // Using -1 to indicate docker is not installed
            (res.error as DockerSpawnError).code = -1;
            throw res.error;
        }

        if (res.status !== 0) {
            const err = new Error(`Docker command exited with code ${res.status} and output the following error: ${res.error || res.stderr.toString()}`);
            // Using -1 as a fallback, should have already been caught by res.error
            (err as DockerSpawnError).code = res.status || -1;
            throw err;
        }

        // @ts-expect-error
    } catch (e: DockerSpawnError) {
        const platform = process.platform;
        const actionItems = e.code !== -1 ? [(platform in START_DOCKER_COMMAND ? "Start Docker" : "Try again")] : ["Install Docker Desktop", "Try again"];
        return vscode.window.showErrorMessage("Error starting Docker", { modal: true, detail: (e as DockerSpawnError).toString() }, ...actionItems).then(async (value) => {
            switch (value) {
                case "Start Docker":
                    spawnSync(START_DOCKER_COMMAND[platform as keyof typeof START_DOCKER_COMMAND], { shell: true });
                case "Install Docker Desktop":
                    vscode.env.openExternal(vscode.Uri.parse("https://www.docker.com/products/docker-desktop"));
                    return;
                case "Try again":
                    return 'RETRY';
            }
        });
    }
};