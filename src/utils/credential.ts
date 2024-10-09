import { spawnSync } from "child_process";
import { env } from "vscode";

export const getCredential = async (service: string) => {
    const auth = spawnSync(
        `echo "https://index.docker.io/v1/" | docker-credential-desktop get`,
        {
            shell: process.platform === 'win32' ? "powershell" : true,
        }
    );
    let Username = `vscode-${env.machineId}`;
    let Password = "";
    if (auth.stdout.toString().startsWith("{") && auth.status === 0 && !auth.error) {
        try {
            const authPayload = JSON.parse(auth.stdout.toString()) as {
                "ServerURL": string,
                "Username": string,
                "Secret": string
            };
            Username = authPayload.Username;
            Password = authPayload.Secret;
        }
        catch (e) {
            throw new Error(`Expected JSON from docker-credential-desktop, got STDOUT: ${auth.stdout.toString()} STDERR: ${auth.stderr.toString()} ERR: ${(auth.error || "N/A").toString()}`);
        }
    }
    return {
        Username,
        Password
    };
};