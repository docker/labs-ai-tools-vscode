import { QuickPickItem, QuickPickItemKind, ThemeIcon, commands, window, workspace } from "vscode";
import { getPromptTypes } from "./preparePrompt";

// https://github.com/owner/repo/tree/ref/path
// https://github.com/docker/labs-make-runbook/tree/main/prompts/docker
const GitHubURLPattern = /https:\/\/github.com\/(.*)\/(.*)\/tree\/(.*)/;
// github:owner/repo?ref=main&path=prompts/dir
const GitHubRefPattern = /github:(.*)\/(.*)\?ref=(.*)/;

class GitHubRef {
    constructor(owner: string, repo: string, ref: string, args: Record<string, string>) {
        this.owner = owner;
        this.repo = repo;
        this.ref = ref;
        this.args = args;
    }
    owner: string;
    repo: string;
    ref: string;
    args: Record<string, string>;
    toURL() {
        return `https://github.com/${this.owner}/${this.repo}/tree/${this.ref}?${Object.entries(this.args).map(([k, v]) => `${k}=${v}`).join("&")}`;
    }
    toRef() {
        return `github:${this.owner}/${this.repo}?ref=${this.ref}&${Object.entries(this.args).map(([k, v]) => `${k}=${v}`).join("&")}`;
    }
    toString() {
        return `Repo: <${this.owner}/${this.repo}> Ref: <${this.ref}> Args: <${Object.entries(this.args).map(([key, val]) => `${key}=${val}`).join(',')}>`
    }
}

export const parseGitHubURL = (url: string) => {
    const githubURLMatch = url.match(GitHubURLPattern);
    if (githubURLMatch) {
        const [, owner, repo, refPart] = githubURLMatch;
        const [ref, ...pathAndArgs] = refPart.split("/");
        const pathAndArgsStr = pathAndArgs.join("/");

        let path: string;
        let args: string[] = [];
        if (!pathAndArgsStr.includes("?")) {
            args = [];
            path = pathAndArgsStr;
        }
        else {
            let argPart = "";
            [path, argPart] = pathAndArgsStr.split("?");
            args = argPart.split("&");
        }

        const keyVals = args.map(a => ({ [a.split("=")[0]]: a.split("=")[1] }));
        keyVals.push({ path });

        return new GitHubRef(owner, repo, ref, Object.assign({}, ...keyVals));
    }
    return undefined;
};

export const parseGitHubRef = (ref: string) => {
    const githubRefMatch = ref.match(GitHubRefPattern);
    if (githubRefMatch) {
        const [, owner, repo, refPart] = githubRefMatch;
        let [ref, ...args] = refPart.split("&");
        const keyVals = args.map(a => ({ [a.split("=")[0]]: a.split("=")[1] }));
        return new GitHubRef(owner, repo, ref, Object.assign({}, ...keyVals));
    };

    return undefined;
};

export interface PromptTypeOption extends QuickPickItem {
    id: string;
    saved?: boolean;
}

export const showPromptPicker = (skipBuiltins = false) =>
    new Promise<PromptTypeOption | undefined>((resolve) => {
        let promptTypeItems: PromptTypeOption[] = [];
        if (!skipBuiltins) {
            const promptTypes = getPromptTypes();
            promptTypeItems = promptTypes.map(f => (
                {
                    label: f.title,
                    detail: `Generate runbook to use ${f.type} in this project`,
                    id: f.type,
                    description: "Built-in",
                    buttons: f.saved ? [{
                        iconPath: new ThemeIcon('trash'),
                        tooltip: 'Delete saved command'
                    }] : undefined,
                    saved: f.saved
                }
            ));
        }
        const getDefaultItems = () => {
            const defaultItems = [
                {
                    kind: QuickPickItemKind.Separator,
                    label: "Saved",
                    id: "separator"
                } as PromptTypeOption,
                ...promptTypeItems.filter(i => i.saved),
                {
                    kind: QuickPickItemKind.Separator,
                    label: "Built-In",
                    id: "separator"
                } as PromptTypeOption,
                ...promptTypeItems.filter(i => !i.saved)
            ];

            return defaultItems;
        };

        const quickPick = window.createQuickPick<PromptTypeOption>();
        quickPick.items = getDefaultItems();
        quickPick.title = "Select runbook type";
        quickPick.ignoreFocusOut = true;
        quickPick.onDidChangeValue((val) => {
            const githubRefMatch = val.match(GitHubRefPattern);
            const githubURLMatch = val.match(GitHubURLPattern);
            if (githubRefMatch) {
                const ref = parseGitHubRef(val)!;
                quickPick.items = [{
                    id: ref.toRef(),
                    label: "GitHub Ref", // Label must be val for quickpick to work properly
                    detail: ref.toString(), // Detail must be val for consistency
                    description: "github:owner/repo?ref=main&path=your/prompts/dir",
                    alwaysShow: true,
                    // Button for saving command to workspace config
                    buttons: skipBuiltins ? [] : [{
                        iconPath: new ThemeIcon('save'),
                        tooltip: 'Save command to workspace configuration'
                    }]
                }];
            }
            //https://github.com/docker/labs-make-runbook/tree/main/prompts/npm_setup
            else if (githubURLMatch) {
                const ref = parseGitHubURL(val)!;
                quickPick.items = [{
                    id: ref.toRef(),
                    label: "GitHub URL", // Label must be val for quickpick to work properly
                    detail: ref.toString(), // Detail must be val for consistency
                    description: "Parsed GitHub URL",
                    alwaysShow: true,
                    // Button for saving command to workspace config
                    buttons: skipBuiltins ? [] : [{
                        iconPath: new ThemeIcon('save'),
                        tooltip: 'Save command to workspace configuration'
                    }]
                }];
            }
            else {
                if (val.startsWith('github:') || val.startsWith('https://github.com')) {
                    quickPick.items = [{
                        id: val,
                        label: "Invalid GitHub Ref",
                        detail: "Please enter a valid GitHub ref or URL",
                        description: "github:owner/repo?ref=main&path=your/prompts/dir",
                        alwaysShow: true,
                    }];
                }
                else {
                    quickPick.items = getDefaultItems();
                }
            }
        });
        quickPick.onDidAccept(() => {
            resolve(quickPick.selectedItems[0]);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            resolve(undefined);
        });
        quickPick.onDidTriggerItemButton(async ({ item }) => {
            if (item.id) {
                if (item.saved) {
                    await commands.executeCommand("docker.make-runbook.delete-prompt", item.id);
                    quickPick.items = getDefaultItems();
                }
                else {
                    await commands.executeCommand("docker.make-runbook.save-prompt", item.id);
                    quickPick.items = getDefaultItems();
                }

            }
        });
        quickPick.show();
    });
