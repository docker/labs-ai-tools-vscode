import { QuickPickItem, window } from "vscode";
import { getPromptTypes } from "./preparePrompt";

export const getPromptForPrompt = () =>
    new Promise<QuickPickItem | undefined>((resolve) => {

        const promptTypes = getPromptTypes();
        const promptTypeItems = promptTypes.map(f => (
            { label: f.title, detail: `Built-in prompt`, index: f.type }
        ));
        const quickPick = window.createQuickPick();
        quickPick.items = promptTypeItems;
        quickPick.title = "Select runbook type";
        quickPick.ignoreFocusOut = true;
        quickPick.onDidChangeValue((val) => {
            // github:owner/repo?ref=main&path=prompts/dir
            if (val.startsWith("github:")) {
                const ghref = val.split("github:")[1];
                const [ownerRepo, query] = ghref.split("?").length > 1 ? ghref.split("?") : ["org-or-user/repo", "ref=unset&path=your/prompts/dir"];
                const [owner, repo] = ownerRepo.split("/");
                const [ref, ...args] = query.split("&");
                quickPick.items = [{
                    label: val,
                    detail: `Repo: <${owner}/${repo}> Ref: <${ref}> Args: <${args.join("&")}>`,
                    description: `Format: github:owner/repo?ref=main&path=your/prompts/dir`
                }];
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
