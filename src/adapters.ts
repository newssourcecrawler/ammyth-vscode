import { spawn } from "child_process";

export interface AdapterRuntime {
    evidenceProviderPath: string;
    assignmentProviderPath: string;
    verificationProviderPath: string;
}

export type ProviderRole =
    | "assignment"
    | "evidence"
    | "verification";

export type ProviderRequest =
    | {
          role: "evidence";
          cliPath: string;
          workspace: string;
          workItemID: string;
          framePath: string;
          caseIndex: number;
      }
    | {
          role: "assignment";
          cliPath: string;
          workspace: string;
          workItemID: string;
          handoffPath: string;
          worker: string;
      }
    | {
          role: "verification";
          cliPath: string;
          verifierCliPath: string;
          workspace: string;
          workItemID: string;
          envelopePath: string;
          payloadPath: string;
      };

function providerCommand(
    runtime: AdapterRuntime,
    request: ProviderRequest
): {
    executable: string;
    args: string[];
    failureLabel: string;
} {
    switch (request.role) {
        case "evidence":
            return {
                executable: runtime.evidenceProviderPath,
                args: [
                    "--cli",
                    request.cliPath,
                    "--workspace",
                    request.workspace,
                    "--work-item-id",
                    request.workItemID,
                    "--frame",
                    request.framePath,
                    "--case-index",
                    String(request.caseIndex)
                ],
                failureLabel: "Evidence provider"
            };

        case "assignment":
            return {
                executable: runtime.assignmentProviderPath,
                args: [
                    "--cli",
                    request.cliPath,
                    "--workspace",
                    request.workspace,
                    "--work-item-id",
                    request.workItemID,
                    "--handoff",
                    request.handoffPath,
                    "--worker",
                    request.worker
                ],
                failureLabel: "Assignment provider"
            };

        case "verification":
            return {
                executable: runtime.verificationProviderPath,
                args: [
                    "--cli",
                    request.cliPath,
                    "--nubuck-cli",
                    request.verifierCliPath,
                    "--workspace",
                    request.workspace,
                    "--work-item-id",
                    request.workItemID,
                    "--envelope",
                    request.envelopePath,
                    "--payload",
                    request.payloadPath
                ],
                failureLabel: "Verification provider"
            };
    }
}

export function runProvider(
    runtime: AdapterRuntime,
    request: ProviderRequest
): Promise<string> {
    const command =
        providerCommand(runtime, request);

    return new Promise((resolve, reject) => {
        const child = spawn(
            command.executable,
            command.args,
            {
                stdio: ["ignore", "pipe", "pipe"]
            }
        );

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        child.stdout.on("data", (chunk: Buffer) => {
            stdoutChunks.push(chunk);
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderrChunks.push(chunk);
        });

        child.on("error", reject);

        child.on("close", (code: number | null) => {
            const stdout =
                Buffer.concat(stdoutChunks).toString("utf8");

            const stderr =
                Buffer.concat(stderrChunks).toString("utf8");

            if (code === 0) {
                resolve(stdout);
                return;
            }

            const stderrMessage = stderr.trim();
            const stdoutMessage = stdout.trim();

            reject(
                new Error(
                    stderrMessage ||
                    stdoutMessage ||
                    `${command.failureLabel} exited with code ${
                        code ?? "unknown"
                    }`
                )
            );
        });
    });
}