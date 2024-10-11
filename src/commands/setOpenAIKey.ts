import { SecretStorage, window } from "vscode";

const setKey = async (secrets: SecretStorage) => {
    const key = await window.showInputBox({
        title: "OpenAI API Key",
        password: true,
        prompt: "Enter your OpenAI API key",
        ignoreFocusOut: true,
    });
    if (!key) {
        // return;
        await secrets.delete('openAIKey');
        return;
    }
    await secrets.store('openAIKey', key);
    void window.showInformationMessage("OpenAI key set.");
};

export const setOpenAIKey = async (secrets: SecretStorage, skipQuickPick: boolean = false) => {
    if (skipQuickPick) {
        await setKey(secrets);
        return;
    }

    const option = await window.showQuickPick([{ label: "Set key" }, { label: "Delete key" }], {
        ignoreFocusOut: true,
    });
    if (!option) {
        return;
    }
    if (option.label === "Set key") {
        await setKey(secrets);
    } else {
        await secrets.delete('openAIKey');
        window.showInformationMessage('OpenAI key deleted');
    }

};


export const verifyHasOpenAIKey = async (secrets: SecretStorage, didRunAutomatically = false) => {
    const openAIKey = await secrets.get('openAIKey');
    if (!openAIKey) {
        return await window.showErrorMessage('No OpenAI API key found. Please set one or use a dummy key for Ollama.', {
            modal: didRunAutomatically
        }, 'Set Key',).then(
            async (res) => {
                if (res === 'Set Key') {
                    await setOpenAIKey(secrets, true);
                    return true;
                }
                else {
                    return false;
                }
            });
    }
    return true;
};