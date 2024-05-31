import { spawnSync } from "child_process";
import { workspace } from "vscode";

type PromptTypes = [ { title: string, type: string } ];

export const getPromptTypes = function(): PromptTypes {
    const promptImage = workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;
    const result = spawnSync('docker', ['run', '--rm', promptImage, "prompts"]);
    return JSON.parse(result.stdout.toString());
};

export const prepareProjectPrompt = (facts: { [key: string]: any }, username: string, promptType: string) => {

    const platform = process.platform;

    const promptImage = workspace.getConfiguration('docker.make-runbook').get('prompt-image') as string;

    // TODO - bind mount to local dir
    const result = spawnSync('docker', ['run', '--rm', promptImage, JSON.stringify(facts), username, JSON.stringify(platform), promptType]);

    if (result.error) {
        throw result.error;
    }

    return JSON.parse(result.stdout.toString());
};
