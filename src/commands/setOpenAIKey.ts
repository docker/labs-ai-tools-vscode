import { SecretStorage, window } from "vscode";

export const setOpenAIKey = async (secrets: SecretStorage) => {
    const key = await window.showInputBox({
        title: "OpenAI API Key",
    });
    if (!key) {
        return;
    }
    await secrets.store('openAIKey', key);
    window.showInformationMessage(`Secret set: ${(await secrets.get('openAIKey'))?.slice(0, 5)}...`);
};