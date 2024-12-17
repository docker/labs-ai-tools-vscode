import { SecretStorage, ThemeIcon, window } from "vscode";

export const showSetSecretDialog = async (secrets: SecretStorage) => {
    const modelProviders = require('../modelproviders.json') as { label: string, id: string, patterns: string[] }[];

    type QuickPickItem = {
        label: string;
        id: string;
        buttons: {
            iconPath: ThemeIcon;
            tooltip: string;
            onClick: () => void;
        }[];
    };

    const quickPick = window.createQuickPick<QuickPickItem>();


    quickPick.items = modelProviders.map(provider => ({
        label: provider.label,
        id: provider.id,
        buttons: [{
            iconPath: new ThemeIcon('trashcan'),
            tooltip: 'Clear', onClick: () => {
                secrets.delete(provider.id);
                void window.showInformationMessage(`${provider.label} key cleared.`);
            }
        }]
    }));

    const modelProvider = await new Promise<QuickPickItem | undefined>((resolve) => {
        quickPick.onDidAccept(() => {
            resolve(quickPick.selectedItems[0]);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            resolve(undefined);
        });
        quickPick.onDidTriggerItemButton((event) => {
            secrets.delete(event.item.id);
            void window.showInformationMessage(`${event.item.label} key cleared.`);
            resolve(undefined);
            quickPick.hide();
        });
        quickPick.show();
    });

    if (!modelProvider) {
        return;
    }

    const secret = await window.showInputBox({
        title: `Enter your ${modelProvider.label} API key`,
        password: true,
        prompt: `Enter your ${modelProvider.label} API key`,
        ignoreFocusOut: true,
    });

    if (!secret) {
        return void window.showInformationMessage(`${modelProvider.label} key not set.`);
    }


    await secrets.store(modelProvider.id, secret);
    void window.showInformationMessage(`${modelProvider.label} key set.`);

    return modelProvider.id;
};