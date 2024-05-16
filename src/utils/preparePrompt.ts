import { execSync, spawnSync } from "child_process";
import { workspace } from "vscode";

export const prepareProjectPrompt = (facts: { [key: string]: any }, username: string) => {

    const platform = process.platform;

    const promptImage = workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;

    // Use JQ to pass facts and platform to the prepareRunbookPrompt.js script
    const result = spawnSync('docker', ['run', promptImage, 'prepareRunbookPrompt.js', JSON.stringify(facts), username, JSON.stringify(platform)]);

    if (result.error) {
        throw result.error;
    }

    return JSON.parse(result.stdout.toString());
};
