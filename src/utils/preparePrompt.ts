import { spawnSync } from "child_process";
import { workspace } from "vscode";

export const prepareProjectPrompt = (facts: { [key: string]: any }, username: string) => {

    const platform = process.platform;

    const promptImage = workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;

    // TODO - bind mount to local dir
    const result = spawnSync('docker', ['run', promptImage, JSON.stringify(facts), username, JSON.stringify(platform)]);

    if (result.error) {
        throw result.error;
    }

    return JSON.parse(result.stdout.toString());
};
