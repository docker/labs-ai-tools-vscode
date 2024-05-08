import { execSync, spawnSync } from "child_process";

export const prepareProjectPrompt = (facts: { [key: string]: any }, username: string) => {

    const platform = process.platform;

    // Use JQ to pass facts and platform to the prepareRunbookPrompt.js script
    const result = spawnSync('docker', ['run', 'vonwig/prompts', 'prepareRunbookPrompt.js', JSON.stringify(facts), username, JSON.stringify(platform)]);

    if (result.error) {
        throw result.error;
    }

    return JSON.parse(result.stdout.toString());
};
