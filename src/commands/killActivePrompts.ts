import { window } from "vscode";
import { sendKillSignalToActivePrompts } from "../utils/promptRunner";

const killActivePrompts = () => {
    const result = sendKillSignalToActivePrompts();
    if (result.length > 0) {
        window.showInformationMessage(`Sent kill signal to ${result.length} active prompts.`);
    } else {
        window.showInformationMessage(`No active prompts to kill.`);
    }
}

export default killActivePrompts;