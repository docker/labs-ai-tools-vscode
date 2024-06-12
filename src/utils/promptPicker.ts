import { QuickPickItem, window } from "vscode";
import { getPromptTypes } from "./preparePrompt";

export interface PromptTypeOption extends QuickPickItem {
    id: string;
}

export const showPromptPicker = () =>
    new Promise<PromptTypeOption | undefined>((resolve) => {

        const promptTypes = getPromptTypes();
        const promptTypeItems = promptTypes.map(f => (
            { label: f.title, detail: `Generate runbook to use ${f.type} in this project`, id: f.type, description: "Built-in" }
        ));
        const quickPick = window.createQuickPick<PromptTypeOption>();
        quickPick.items = promptTypeItems;
        quickPick.title = "Select runbook type";
        quickPick.ignoreFocusOut = true;
        quickPick.onDidChangeValue((val) => {
            // github:owner/repo?ref=main&path=prompts/dir
            if (val.startsWith("github:")) {
                try {
                    const ghref = val.split("github:")[1];
                    const [ownerRepo, query] = ghref.split("?").length > 1 ? ghref.split("?") : ["org-or-user/repo", "ref=unset&path=your/prompts/dir"];
                    const [owner, repo] = ownerRepo.split("/");
                    const [ref, ...args] = query.split("&");
                    quickPick.items = [{
                        id: val,
                        label: "GitHub Ref", // Label must be val for quickpick to work properly
                        detail: `Repo: <${owner}/${repo}> Ref: <${ref.split('=')[1]}> Args: <${args.join("&")}>`, // Detail must be val for consistency
                        description: "github:owner/repo?ref=main&path=your/prompts/dir",
                        alwaysShow: true
                    }];
                }
                catch (e) {
                    window.showErrorMessage(`Error parsing ${val}: ${e}`);
                }
            }
            else {
                quickPick.items = promptTypeItems;
            }
        });
        quickPick.onDidAccept(() => {
            resolve(quickPick.selectedItems[0]);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            resolve(undefined);
        });

        quickPick.show();
    });
