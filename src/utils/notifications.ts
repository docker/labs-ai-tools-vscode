import * as rpc from 'vscode-jsonrpc/node';

export const notifications = {
    message: new rpc.NotificationType<{ content: string }>('message'),
    error: new rpc.NotificationType<{ content: string }>('error'),
    functions: new rpc.NotificationType<{ function: { arguments: string, name: string }, id: string }>('functions'),
    "functions-done": new rpc.NotificationType<{ id: string, function: { name: string, arguments: string } }>('functions-done'),
    start: new rpc.NotificationType<{ id: string, function: { name: string, arguments: string } }>('start'),
}
