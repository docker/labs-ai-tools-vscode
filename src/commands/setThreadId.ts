import { window } from "vscode"
import { ctx } from "../extension"

export const setThreadId = async (overwrite = true) => {
    const existingVal = ctx.workspaceState.get<string>('thread_id')
    if (!overwrite) {
        return existingVal
    }

    const resp = await window.showInputBox({
        title: 'Thread ID',
        prompt: 'Enter a simple string to tag the thread volume.'
    })
    if (!resp) {
        window.showErrorMessage('No thread ID set.')
        return undefined;
    }
    await ctx.workspaceState.update('thread_id', resp)
    window.showInformationMessage(`Thread ID set to ${resp}`)
    return resp;
}