import { window } from "vscode"
import { ctx } from "../extension";

export const setProjectDir = async (overwrite = true) => {
    const existingVal = ctx.workspaceState.get<string>('project_dir')
    if (!overwrite && existingVal) {
        return existingVal
    }
    const directory = await window.showOpenDialog({
        openLabel: 'Use this project',
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false
    })
    if (!directory) {
        window.showErrorMessage('Project directory not set.')
        return undefined;
    }
    const path = directory[0].fsPath
    await ctx.workspaceState.update('project_dir', path)
    window.showInformationMessage(`Project directory set to ${path}`)
    return path;
}