import os from 'os';
import http from 'http';
import { ExtensionContext } from 'vscode';

const getDevhome = (): string => {
    return process.env['DEVHOME'] ?? os.homedir();
}

export function getBackendSocketByPlatform(): string {
    switch (os.platform()) {
        case 'darwin':
            return `${getDevhome()}/Library/Containers/com.docker.docker/Data/backend.sock`;
        case 'win32':
            return '\\\\.\\pipe\\dockerBackendApiServer';
        default:
            return `${getDevhome()}/.docker/desktop/backend.sock`;
    }
}

type TrackEvent = {
    event: string;
    properties?: Record<string, string>
}

let defaultProperties = {

}

export const setDefaultProperties = (ctx: ExtensionContext) => {
    defaultProperties = {
        version: ctx.extension.packageJSON.version,
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        vscodeVersion: ctx.extension.packageJSON.version,
    }
}



export const postToBackendSocket = (event: TrackEvent) => {
    event.properties = { ...event.properties, ...defaultProperties }
    const postData = JSON.stringify(event);
    const options = {
        path: '/analytics/track',
        method: 'POST',
        socketPath: getBackendSocketByPlatform(),
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('error', (e) => {
            throw new Error(`problem with response: ${e.message}`);
        });

    });

    req.on('error', (e) => {
        throw new Error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(postData);
    req.end();
}