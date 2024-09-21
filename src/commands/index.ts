// barreli boi
import * as vscode from 'vscode'
import { runPrompt } from './runPrompt';
import { runHotCommand } from './runHotCommand';
import { deletePrompt, savePrompt } from './manageSavedPrompts';
import { setProjectDir } from './setProjectDir';
import { setThreadId } from './setThreadId';

type CTX = { secrets: any }

const commands = (context: CTX) => [
    { id: 'docker.labs-ai-tools-vscode.run-commands', callback: runHotCommand },
    { id: 'docker.labs-ai-tools-vscode.save-prompt', callback: savePrompt },
    { id: 'docker.labs-ai-tools-vscode.delete-prompt', callback: deletePrompt },
    { id: 'docker.labs-ai-tools-vscode.run-workspace-as-prompt', callback: () => runPrompt(context.secrets, 'local-dir') },
    { id: 'docker.labs-ai-tools-vscode.run-file-as-prompt', callback: () => runPrompt(context.secrets, 'local-file') },
    { id: 'docker.labs-ai-tools-vscode.run-prompt', callback: () => runPrompt(context.secrets, 'remote') },
    { id: 'docker.labs-ai-tools-vscode.project-dir', callback: setProjectDir },
    { id: 'docker.labs-ai-tools-vscode.thread-id', callback: setThreadId },
]

export default (context: CTX) => commands(context).map((comm) => vscode.commands.registerCommand(comm.id, comm.callback))