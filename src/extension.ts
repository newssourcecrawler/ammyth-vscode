import * as vscode from "vscode";
import { spawn } from "child_process";
import { runProvider } from "./adapters";
import { resolveAmmythRuntime } from "./runtime";
import {
    getWorkspaceTarget,
    clearWorkspaceTarget
} from "./workspaceTarget";

interface AmmythWorkState {
    protocolVersion: number;
    requestID: string;
    kind: string;
    status: string;
    summary: string;
    nextAction?: string | null;
    workItemID?: string | null;
    revision?: number | null;
    attemptCount?: number | null;
    evidenceCount?: number | null;
    assignmentCount?: number | null;
    workTitle?: string | null;
    completionCriterion?: string | null;
    latestAssignmentWorker?: string | null;
    latestAssignmentTask?: string | null;
    latestAssignmentReason?: string | null;
}

class AssignmentProposalViewProvider
    implements vscode.WebviewViewProvider {

    public static readonly viewType =
        "ammyth.assignmentProposal";

    private view?: vscode.WebviewView;

    constructor(
        private readonly propose: (
            worker: string,
            task: string,
            reason: string
        ) => Promise<boolean>
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.html();

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type !== "propose") {
                    return;
                }

                const ok = await this.propose(
                    String(message.worker ?? ""),
                    String(message.task ?? ""),
                    String(message.reason ?? "")
                );

                if (!ok) {
                    return;
                }

                await webviewView.webview.postMessage({
                    type: "proposalSaved"
                });
            }
        );
    }

    private html(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body {
        padding: 8px 10px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
    }

    .row {
        margin-bottom: 8px;
    }

    label {
        display: block;
        margin-bottom: 3px;
        font-size: 12px;
    }

    input,
    textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 5px 7px;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        font: inherit;
    }

    textarea {
        resize: vertical;
        min-height: 44px;
        max-height: 90px;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    button {
        padding: 5px 12px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        cursor: pointer;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }
</style>
</head>

<body>
    <div class="row">
        <label for="worker">Worker</label>
        <input
            id="worker"
            value="codex"
            autocomplete="off"
        />
    </div>

    <div class="row">
        <label for="task">Task</label>
        <textarea
            id="task"
            placeholder="Work to propose"
        ></textarea>
    </div>

    <div class="row">
        <label for="reason">Reason</label>
        <textarea
            id="reason"
            placeholder="Optional"
        ></textarea>
    </div>

    <div class="actions">
        <button id="propose">
            Propose
        </button>
    </div>

<script>
    const vscode = acquireVsCodeApi();

    document
        .getElementById("propose")
        .addEventListener("click", () => {
            const worker =
                document.getElementById("worker").value;

            const task =
                document.getElementById("task").value;

            const reason =
                document.getElementById("reason").value;

            if (!task.trim()) {
                return;
            }

            vscode.postMessage({
                type: "propose",
                worker,
                task,
                reason
            });
        });
        window.addEventListener("message", event => {
            const message = event.data;

            if (message.type !== "proposalSaved") {
                return;
            }

            document.getElementById("task").value = "";
            document.getElementById("reason").value = "";

            const button = document.getElementById("propose");
            button.textContent = "Proposed";

            setTimeout(() => {
                button.textContent = "Propose";
            }, 1200);
        });
</script>
</body>
</html>
`;
    }
}

class RecordResultViewProvider
    implements vscode.WebviewViewProvider {

    public static readonly viewType =
        "ammyth.recordResult";

    constructor(
        private readonly record: (
            worker: string,
            summary: string,
            resultReference: string
        ) => Promise<boolean>
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.html();

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type !== "record") {
                    return;
                }

                const ok = await this.record(
                    String(message.worker ?? ""),
                    String(message.summary ?? ""),
                    String(message.resultReference ?? "")
                );

                await webviewView.webview.postMessage({
                    type: "recordResult",
                    ok
                });
            }
        );
    }

    private html(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body {
        padding: 8px 10px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
    }

    .row {
        margin-bottom: 8px;
    }

    label {
        display: block;
        margin-bottom: 3px;
        font-size: 12px;
    }

    input,
    textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 5px 7px;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        font: inherit;
    }

    textarea {
        resize: vertical;
        min-height: 44px;
        max-height: 90px;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    button {
        padding: 5px 12px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        cursor: pointer;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }
</style>
</head>

<body>
    <div class="row">
        <label for="worker">Worker</label>
        <input
            id="worker"
            value="codex"
            autocomplete="off"
        />
    </div>

    <div class="row">
        <label for="summary">Summary</label>
        <textarea
            id="summary"
            placeholder="What did the worker do?"
        ></textarea>
    </div>

    <div class="row">
        <label for="resultReference">Result reference</label>
        <input
            id="resultReference"
            placeholder="Optional"
            autocomplete="off"
        />
    </div>

    <div class="actions">
        <button id="record">
            Record
        </button>
    </div>

<script>
    const vscode = acquireVsCodeApi();

    document
        .getElementById("record")
        .addEventListener("click", () => {
            const worker =
                document.getElementById("worker").value;

            const summary =
                document.getElementById("summary").value;

            const resultReference =
                document.getElementById("resultReference").value;

            if (!summary.trim()) {
                return;
            }

            vscode.postMessage({
                type: "record",
                worker,
                summary,
                resultReference
            });
        });

    window.addEventListener("message", event => {
        const message = event.data;

        if (
            message.type !== "recordResult" ||
            !message.ok
        ) {
            return;
        }

        document.getElementById("summary").value = "";
        document.getElementById("resultReference").value = "";

        const button = document.getElementById("record");
        button.textContent = "Recorded";

        setTimeout(() => {
            button.textContent = "Record";
        }, 1200);
    });
</script>
</body>
</html>
`;
    }
}

class RecordEvidenceViewProvider
    implements vscode.WebviewViewProvider {

    public static readonly viewType =
        "ammyth.recordEvidence";

    constructor(
        private readonly record: (
            source: string,
            summary: string,
            reference: string
        ) => Promise<boolean>
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.html();

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type !== "recordEvidence") {
                    return;
                }

                const ok = await this.record(
                    String(message.source ?? ""),
                    String(message.summary ?? ""),
                    String(message.reference ?? "")
                );

                await webviewView.webview.postMessage({
                    type: "recordEvidenceResult",
                    ok
                });
            }
        );
    }

    private html(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body {
        padding: 8px 10px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
    }

    .row {
        margin-bottom: 8px;
    }

    label {
        display: block;
        margin-bottom: 3px;
        font-size: 12px;
    }

    input,
    textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 5px 7px;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        font: inherit;
    }

    textarea {
        resize: vertical;
        min-height: 44px;
        max-height: 90px;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    button {
        padding: 5px 12px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        cursor: pointer;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }
</style>
</head>

<body>
    <div class="row">
        <label for="source">Source</label>
        <input
            id="source"
            placeholder="e.g. external provider"
            autocomplete="off"
        />
    </div>

    <div class="row">
        <label for="summary">Summary</label>
        <textarea
            id="summary"
            placeholder="Diagnostic evidence"
        ></textarea>
    </div>

    <div class="row">
        <label for="reference">Reference</label>
        <input
            id="reference"
            placeholder="Optional"
            autocomplete="off"
        />
    </div>

    <div class="actions">
        <button id="recordEvidence">
            Record
        </button>
    </div>

<script>
    const vscode = acquireVsCodeApi();

    document
        .getElementById("recordEvidence")
        .addEventListener("click", () => {
            const source =
                document.getElementById("source").value;

            const summary =
                document.getElementById("summary").value;

            const reference =
                document.getElementById("reference").value;

            if (!source.trim() || !summary.trim()) {
                return;
            }

            vscode.postMessage({
                type: "recordEvidence",
                source,
                summary,
                reference
            });
        });

    window.addEventListener("message", event => {
        const message = event.data;

        if (
            message.type !== "recordEvidenceResult" ||
            !message.ok
        ) {
            return;
        }

        document.getElementById("summary").value = "";
        document.getElementById("reference").value = "";

        const button =
            document.getElementById("recordEvidence");

        button.textContent = "Recorded";

        setTimeout(() => {
            button.textContent = "Record";
        }, 1200);
    });
</script>
</body>
</html>
`;
    }
}

class ReviewResultViewProvider
    implements vscode.WebviewViewProvider {

    public static readonly viewType =
        "ammyth.reviewResult";

    constructor(
        private readonly review: (
            accepted: boolean | undefined,
            blockedReason: string,
            clearBlockedReason: boolean,
            termination: string,
            clearTermination: boolean
        ) => Promise<boolean>
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void {
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.html();

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type !== "review") {
                    return;
                }

                let accepted: boolean | undefined;

                if (message.accepted === "true") {
                    accepted = true;
                } else if (message.accepted === "false") {
                    accepted = false;
                }

                const ok = await this.review(
                    accepted,
                    String(message.blockedReason ?? ""),
                    Boolean(message.clearBlockedReason),
                    String(message.termination ?? ""),
                    Boolean(message.clearTermination)
                );

                await webviewView.webview.postMessage({
                    type: "reviewResult",
                    ok
                });
            }
        );
    }

    private html(): string {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body {
        padding: 8px 10px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
    }

    .row {
        margin-bottom: 8px;
    }

    label {
        display: block;
        margin-bottom: 3px;
        font-size: 12px;
    }

    input,
    select {
        box-sizing: border-box;
        width: 100%;
        padding: 5px 7px;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        font: inherit;
    }

    .check {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        font-size: 12px;
    }

    .check input {
        width: auto;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    button {
        padding: 5px 12px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        cursor: pointer;
    }

    button:hover {
        background: var(--vscode-button-hoverBackground);
    }
</style>
</head>

<body>
    <div class="row">
        <label for="accepted">Accepted</label>
        <select id="accepted">
            <option value="">Preserve</option>
            <option value="true">True</option>
            <option value="false">False</option>
        </select>
    </div>

    <div class="row">
        <label for="blockedReason">Blocked reason</label>
        <input
            id="blockedReason"
            placeholder="Optional"
            autocomplete="off"
        />

        <label class="check">
            <input
                id="clearBlockedReason"
                type="checkbox"
            />
            Clear blocker
        </label>
    </div>

    <div class="row">
        <label for="termination">Termination</label>
        <input
            id="termination"
            placeholder="Optional"
            autocomplete="off"
        />

        <label class="check">
            <input
                id="clearTermination"
                type="checkbox"
            />
            Clear termination
        </label>
    </div>

    <div class="actions">
        <button id="review">
            Review
        </button>
    </div>

<script>
    const vscode = acquireVsCodeApi();

    document
        .getElementById("review")
        .addEventListener("click", () => {
            const accepted =
                document.getElementById("accepted").value;

            const blockedReason =
                document.getElementById("blockedReason").value;

            const clearBlockedReason =
                document.getElementById("clearBlockedReason").checked;

            const termination =
                document.getElementById("termination").value;

            const clearTermination =
                document.getElementById("clearTermination").checked;

            const hasReviewChange =
                accepted !== "" ||
                blockedReason.trim().length > 0 ||
                clearBlockedReason ||
                termination.trim().length > 0 ||
                clearTermination;

            if (!hasReviewChange) {
                return;
            }

            vscode.postMessage({
                type: "review",
                accepted,
                blockedReason,
                clearBlockedReason,
                termination,
                clearTermination
            });
        });

    window.addEventListener("message", event => {
        const message = event.data;

        if (
            message.type !== "reviewResult" ||
            !message.ok
        ) {
            return;
        }

        const button = document.getElementById("review");
        button.textContent = "Reviewed";

        setTimeout(() => {
            button.textContent = "Review";
        }, 1200);
    });
</script>
</body>
</html>
`;
    }
}

function runAmmythCLI(
    cliPath: string,
    request: object
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(cliPath, [], {
            stdio: ["pipe", "pipe", "pipe"]
        });

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
            const stdout = Buffer.concat(stdoutChunks).toString("utf8");
            const stderr = Buffer.concat(stderrChunks).toString("utf8");

            if (code === 0) {
                resolve(stdout);
                return;
            }

            const stdoutMessage = stdout.trim();
            const stderrMessage = stderr.trim();

            reject(
                new Error(
                    stdoutMessage ||
                    stderrMessage ||
                    `Ammyth CLI exited with code ${code ?? "unknown"}`
                )
            );
        });

        child.stdin.end(JSON.stringify(request));
    });
}

class WorkStateTreeProvider
    implements vscode.TreeDataProvider<vscode.TreeItem> {

    private readonly _onDidChangeTreeData =
        new vscode.EventEmitter<vscode.TreeItem | undefined>();

    readonly onDidChangeTreeData =
        this._onDidChangeTreeData.event;

    private state: AmmythWorkState | null = null;

    setState(state: AmmythWorkState): void {
        this.state = state;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        if (!this.state) {
            return [
                new vscode.TreeItem(
                    "No work state loaded",
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        const state = this.state;

        return [
            new vscode.TreeItem(
                `Status: ${state.status}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Summary: ${state.summary}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `What remains: ${state.nextAction ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Work: ${state.workTitle ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Completion: ${state.completionCriterion ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `WorkItem: ${state.workItemID ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Revision: ${state.revision ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Attempts: ${state.attemptCount ?? 0}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Evidence: ${state.evidenceCount ?? 0}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Assignments: ${state.assignmentCount ?? 0}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Latest worker: ${state.latestAssignmentWorker ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Latest task: ${state.latestAssignmentTask ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            ),
            new vscode.TreeItem(
                `Latest reason: ${state.latestAssignmentReason ?? "—"}`,
                vscode.TreeItemCollapsibleState.None
            )
        ];
    }
}

export function activate(context: vscode.ExtensionContext): void {

    const workStateProvider =
        new WorkStateTreeProvider();

    const workStateView =
        vscode.window.createTreeView(
            "ammyth.workState",
            {
                treeDataProvider: workStateProvider
            }
        );

    const loadCurrentWorkState = async (
        workspace?: string
    ): Promise<AmmythWorkState | null> => {
        const targetWorkspace =
            workspace ?? await getWorkspaceTarget();

        if (!targetWorkspace) {
            return null;
        }

        const request = {
            protocolVersion: 1,
            requestID: `vscode-inspect-${Date.now()}`,
            kind: "load_work_state",
            workspace: targetWorkspace
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                request
            );
            const response = JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);

            return response;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth CLI failed: ${message}`
            );

            return null;
        }
    };

    const initializeWorkState = async (): Promise<boolean> => {
        const workspace = await getWorkspaceTarget();

        if (!workspace) {
            return false;
        }

        const loadRequest = {
            protocolVersion: 1,
            requestID: `vscode-initialize-check-${Date.now()}`,
            kind: "load_work_state",
            workspace
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                loadRequest
            );

            const existingState =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(existingState);

            await vscode.window.showInformationMessage(
                "Ammyth work is already initialized."
            );

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            let status: string | undefined;

            try {
                const parsed =
                    JSON.parse(message) as {
                        status?: string;
                    };

                status = parsed.status;
            } catch {
                status = undefined;
            }

            if (status !== "work_state_not_found") {
                await vscode.window.showErrorMessage(
                    `Ammyth initialization check failed: ${message}`
                );
                return false;
            }
        }

        const initializeRequest = {
            protocolVersion: 1,
            requestID: `vscode-initialize-${Date.now()}`,
            kind: "evaluate_work_state",
            workspace,
            expectedRevision: 0
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                initializeRequest
            );

            const response =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);

            await vscode.window.showInformationMessage(
                "Ammyth work initialized."
            );

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth initialization failed: ${message}`
            );

            return false;
        }
    };

    const proposeAssignment = async (
        worker: string,
        task: string,
        reason: string
    ): Promise<boolean> => {
        const workspace = await getWorkspaceTarget();

        if (!workspace) {
            return false;
        }

        const state = await loadCurrentWorkState(workspace);

        if (
            !state ||
            state.revision === undefined ||
            state.revision === null
        ) {
            return false;
        }

        if (task.trim().length === 0) {
            return false;
        }

        const request = {
            protocolVersion: 1,
            requestID: `vscode-assignment-${Date.now()}`,
            kind: "propose_assignment",
            workspace,
            expectedRevision: state.revision,
            assignmentWorker:
                worker.trim().length > 0
                    ? worker.trim()
                    : "external-agent",
            assignmentTask: task.trim(),
            assignmentReason:
                reason.trim().length > 0
                    ? reason.trim()
                    : "Ammyth assignment proposal."
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                request
            );

            const response =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);
            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth assignment proposal failed: ${message}`
            );
            return false;
        }
    };

    const recordAttempt = async (
        worker: string,
        summary: string,
        resultReference: string
    ): Promise<boolean> => {
        const workspace = await getWorkspaceTarget();

        if (!workspace) {
            return false;
        }

        const state = await loadCurrentWorkState(workspace);

        if (
            !state ||
            state.revision === undefined ||
            state.revision === null
        ) {
            return false;
        }

        if (summary.trim().length === 0) {
            return false;
        }

        const request = {
            protocolVersion: 1,
            requestID: `vscode-attempt-${Date.now()}`,
            kind: "record_attempt",
            workspace,
            expectedRevision: state.revision,
            worker:
                worker.trim().length > 0
                    ? worker.trim()
                    : "external-agent",
            attemptSummary: summary.trim(),
            resultReference:
                resultReference.trim().length > 0
                    ? resultReference.trim()
                    : undefined
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                request
            );

            const response =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth result recording failed: ${message}`
            );

            return false;
        }
    };

    const recordEvidence = async (
        source: string,
        summary: string,
        reference: string
    ): Promise<boolean> => {
        const workspace = await getWorkspaceTarget();

        if (!workspace) {
            return false;
        }

        const state = await loadCurrentWorkState(workspace);

        if (
            !state ||
            state.revision === undefined ||
            state.revision === null
        ) {
            return false;
        }

        const normalizedSource = source.trim();
        const normalizedSummary = summary.trim();
        const normalizedReference = reference.trim();

        if (
            normalizedSource.length === 0 ||
            normalizedSummary.length === 0
        ) {
            return false;
        }

        const request = {
            protocolVersion: 1,
            requestID: `vscode-evidence-${Date.now()}`,
            kind: "record_evidence",
            workspace,
            expectedRevision: state.revision,
            evidenceSource: normalizedSource,
            evidenceSummary: normalizedSummary,
            evidenceReference:
                normalizedReference.length > 0
                    ? normalizedReference
                    : undefined
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                request
            );

            const response =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth evidence recording failed: ${message}`
            );

            return false;
        }
    };

    const reviewResult = async (
        accepted: boolean | undefined,
        blockedReason: string,
        clearBlockedReason: boolean,
        termination: string,
        clearTermination: boolean
    ): Promise<boolean> => {
        const workspace = await getWorkspaceTarget();

        if (!workspace) {
            return false;
        }

        const state = await loadCurrentWorkState(workspace);

        if (
            !state ||
            state.revision === undefined ||
            state.revision === null
        ) {
            return false;
        }

        const normalizedBlockedReason =
            blockedReason.trim();

        const normalizedTermination =
            termination.trim();

        const hasReviewChange =
            accepted !== undefined ||
            normalizedBlockedReason.length > 0 ||
            clearBlockedReason ||
            normalizedTermination.length > 0 ||
            clearTermination;

        if (!hasReviewChange) {
            return false;
        }

        const request = {
            protocolVersion: 1,
            requestID: `vscode-review-${Date.now()}`,
            kind: "review_result",
            workspace,
            expectedRevision: state.revision,
            accepted,
            blockedReason:
                !clearBlockedReason &&
                normalizedBlockedReason.length > 0
                    ? normalizedBlockedReason
                    : undefined,
            clearBlockedReason:
                clearBlockedReason ? true : undefined,
            termination:
                !clearTermination &&
                normalizedTermination.length > 0
                    ? normalizedTermination
                    : undefined,
            clearTermination:
                clearTermination ? true : undefined
        };

        try {
            const runtime = resolveAmmythRuntime();
            const stdout = await runAmmythCLI(
                runtime.cliPath,
                request
            );

            const response =
                JSON.parse(stdout) as AmmythWorkState;

            workStateProvider.setState(response);

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            await vscode.window.showErrorMessage(
                `Ammyth result review failed: ${message}`
            );

            return false;
        }
    };

    const assignmentProposalProvider =
        new AssignmentProposalViewProvider(
            proposeAssignment
        );

    const recordResultProvider =
        new RecordResultViewProvider(
            recordAttempt
        );

    const recordEvidenceProvider =
        new RecordEvidenceViewProvider(
            recordEvidence
        );

    const reviewResultProvider =
        new ReviewResultViewProvider(
            reviewResult
        );

    const recordResultView =
        vscode.window.registerWebviewViewProvider(
            RecordResultViewProvider.viewType,
            recordResultProvider
        );

    const recordEvidenceView =
        vscode.window.registerWebviewViewProvider(
            RecordEvidenceViewProvider.viewType,
            recordEvidenceProvider
        );

    const reviewResultView =
        vscode.window.registerWebviewViewProvider(
            ReviewResultViewProvider.viewType,
            reviewResultProvider
        );

    const assignmentProposalView =
        vscode.window.registerWebviewViewProvider(
            AssignmentProposalViewProvider.viewType,
            assignmentProposalProvider
        );

    const inspectCurrentWork = async (): Promise<void> => {
        await loadCurrentWorkState();

        await vscode.commands.executeCommand(
            "workbench.view.extension.ammyth"
        );
    };

    const disposable = vscode.commands.registerCommand(
        "ammyth.inspectCurrentWork",
        inspectCurrentWork
    );

    const refreshCurrentWork = vscode.commands.registerCommand(
        "ammyth.refreshCurrentWork",
        async () => {
            await loadCurrentWorkState();
        }
    );

    const initializeWorkStateCommand =
        vscode.commands.registerCommand(
            "ammyth.initializeWorkState",
            async () => {
                await initializeWorkState();

                await vscode.commands.executeCommand(
                    "workbench.view.extension.ammyth"
                );
            }
        );

    const importEvidenceCommand =
        vscode.commands.registerCommand(
            "ammyth.importEvidence",
            async () => {
                const workspace = await getWorkspaceTarget();

                if (!workspace) {
                    return;
                }

                const selected = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        JSON: ["json"]
                    },
                    openLabel: "Select evidence input"
                });

                if (!selected || selected.length !== 1) {
                    return;
                }

                const caseIndexText =
                    await vscode.window.showInputBox({
                        title: "Import Evidence",
                        prompt: "Zero-based case index",
                        value: "0",
                        validateInput: (value) => {
                            if (!/^\d+$/.test(value.trim())) {
                                return "Enter a nonnegative integer.";
                            }

                            return undefined;
                        }
                    });

                if (caseIndexText === undefined) {
                    return;
                }

                const caseIndex =
                    Number.parseInt(caseIndexText.trim(), 10);

                const state = await loadCurrentWorkState(workspace);

                if (
                    !state ||
                    !state.workItemID ||
                    state.workItemID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Ammyth current work has no WorkItem identity."
                    );
                    return;
                }

                const runtime = resolveAmmythRuntime();
                const cliPath = runtime.cliPath;

                let preparedRequest: {
                    protocolVersion: number;
                    requestID: string;
                    kind: string;
                    workspace: string;
                    expectedRevision: number;
                    evidenceSource: string;
                    evidenceSummary: string;
                    evidenceReference?: string;
                };

                try {
                    const stdout =
                        await runProvider(
                            runtime.adapterRuntime,
                            {
                                role: "evidence",
                                cliPath,
                                workspace,
                                workItemID: state.workItemID,
                                framePath: selected[0].fsPath,
                                caseIndex
                            }
                        );

                    preparedRequest =
                        JSON.parse(stdout) as typeof preparedRequest;
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        `Evidence preparation failed: ${message}`
                    );
                    return;
                }

                if (
                    preparedRequest.kind !== "record_evidence" ||
                    preparedRequest.workspace !== workspace ||
                    !Number.isInteger(
                        preparedRequest.expectedRevision
                    ) ||
                    typeof preparedRequest.evidenceSource !== "string" ||
                    preparedRequest.evidenceSource.trim().length === 0 ||
                    typeof preparedRequest.evidenceSummary !== "string" ||
                    preparedRequest.evidenceSummary.trim().length === 0 ||
                    typeof preparedRequest.requestID !== "string" ||
                    preparedRequest.requestID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Evidence provider returned an invalid request."
                    );
                    return;
                }

                const maxSummaryLength = 2000;

                const previewSummary =
                    preparedRequest.evidenceSummary.length >
                    maxSummaryLength
                        ? (
                            preparedRequest.evidenceSummary.slice(
                                0,
                                maxSummaryLength
                            ) +
                            "\n\n[Preview truncated; full value will be submitted.]"
                        )
                        : preparedRequest.evidenceSummary;

                const confirmation =
                    await vscode.window.showInformationMessage(
                        "Submit prepared evidence?",
                        {
                            modal: true,
                            detail: [
                                `Workspace: ${workspace}`,
                                `WorkItem: ${state.workItemID}`,
                                `Artifact: ${selected[0].fsPath}`,
                                `Case index: ${caseIndex}`,
                                `Expected revision: ${preparedRequest.expectedRevision}`,
                                `Source: ${preparedRequest.evidenceSource}`,
                                "",
                                previewSummary,
                                "",
                                `Reference: ${preparedRequest.evidenceReference ?? "—"}`
                            ].join("\n")
                        },
                        "Submit Evidence"
                    );

                if (confirmation !== "Submit Evidence") {
                    return;
                }

                try {
                    const stdout = await runAmmythCLI(
                        runtime.cliPath,
                        preparedRequest
                    );

                    const response =
                        JSON.parse(stdout) as AmmythWorkState;

                    workStateProvider.setState(response);

                    await vscode.window.showInformationMessage(
                        `Evidence recorded. Revision ${response.revision ?? "—"}, evidence ${response.evidenceCount ?? "—"}.`
                    );
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        message
                    );
                }
            }
        );

    const importAssignmentCommand =
        vscode.commands.registerCommand(
            "ammyth.importAssignment",
            async () => {
                const workspace = await getWorkspaceTarget();
                if (!workspace) {
                    return;
                }

                const selected = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        JSON: ["json"]
                    },
                    openLabel: "Select assignment input"
                });

                if (!selected || selected.length !== 1) {
                    return;
                }

                const worker =
                    await vscode.window.showInputBox({
                        title: "Import Assignment",
                        prompt: "Next worker",
                        value: "codex",
                        validateInput: (value) => {
                            if (value.trim().length === 0) {
                                return "Enter a non-empty worker.";
                            }

                            return undefined;
                        }
                    });

                if (worker === undefined) {
                    return;
                }

                const state = await loadCurrentWorkState(workspace);

                if (
                    !state ||
                    !state.workItemID ||
                    state.workItemID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Ammyth current work has no WorkItem identity."
                    );
                    return;
                }

                const runtime = resolveAmmythRuntime();
                const cliPath = runtime.cliPath;

                let preparedRequest: {
                    protocolVersion: number;
                    requestID: string;
                    kind: string;
                    workspace: string;
                    expectedRevision: number;
                    assignmentWorker: string;
                    assignmentTask: string;
                    assignmentReason: string;
                };

                try {
                    const stdout =
                        await runProvider(
                            runtime.adapterRuntime,
                            {
                                role: "assignment",
                                cliPath,
                                workspace,
                                workItemID: state.workItemID,
                                handoffPath: selected[0].fsPath,
                                worker: worker.trim()
                            }
                        );

                    preparedRequest =
                        JSON.parse(stdout) as typeof preparedRequest;
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        `Assignment preparation failed: ${message}`
                    );
                    return;
                }

                if (
                    preparedRequest.kind !== "propose_assignment" ||
                    preparedRequest.workspace !== workspace ||
                    !Number.isInteger(
                        preparedRequest.expectedRevision
                    ) ||
                    typeof preparedRequest.assignmentWorker !== "string" ||
                    preparedRequest.assignmentWorker.trim().length === 0 ||
                    typeof preparedRequest.assignmentTask !== "string" ||
                    preparedRequest.assignmentTask.trim().length === 0 ||
                    typeof preparedRequest.assignmentReason !== "string" ||
                    preparedRequest.assignmentReason.trim().length === 0 ||
                    typeof preparedRequest.requestID !== "string" ||
                    preparedRequest.requestID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Assignment provider returned an invalid request."
                    );
                    return;
                }

                const confirmation =
                    await vscode.window.showInformationMessage(
                        "Submit prepared assignment?",
                        {
                            modal: true,
                            detail: [
                                `Workspace: ${workspace}`,
                                `WorkItem: ${state.workItemID}`,
                                `Artifact: ${selected[0].fsPath}`,
                                `Expected revision: ${preparedRequest.expectedRevision}`,
                                `Worker: ${preparedRequest.assignmentWorker}`,
                                "",
                                preparedRequest.assignmentTask,
                                "",
                                `Reason: ${preparedRequest.assignmentReason}`
                            ].join("\n")
                        },
                        "Submit Assignment"
                    );

                if (confirmation !== "Submit Assignment") {
                    return;
                }

                try {
                    const stdout = await runAmmythCLI(
                        cliPath,
                        preparedRequest
                    );

                    const response =
                        JSON.parse(stdout) as AmmythWorkState;

                    workStateProvider.setState(response);

                    await vscode.window.showInformationMessage(
                        `Assignment proposed. Revision ${response.revision ?? "—"}, assignments ${response.assignmentCount ?? "—"}.`
                    );
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        message
                    );
                }
            }
        );

    const importVerificationEvidenceCommand =
        vscode.commands.registerCommand(
            "ammyth.importVerificationEvidence",
            async () => {
                const workspace = await getWorkspaceTarget();

                if (!workspace) {
                    return;
                }

                const envelopeSelection =
                    await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        canSelectFiles: true,
                        canSelectFolders: false,
                        filters: {
                            JSON: ["json"]
                        },
                        openLabel: "Select verification envelope"
                    });

                if (
                    !envelopeSelection ||
                    envelopeSelection.length !== 1
                ) {
                    return;
                }

                const payloadSelection =
                    await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        canSelectFiles: true,
                        canSelectFolders: false,
                        filters: {
                            JSON: ["json"]
                        },
                        openLabel: "Select verification payload"
                    });

                if (
                    !payloadSelection ||
                    payloadSelection.length !== 1
                ) {
                    return;
                }

                const state = await loadCurrentWorkState(workspace);

                if (
                    !state ||
                    !state.workItemID ||
                    state.workItemID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Ammyth current work has no WorkItem identity."
                    );
                    return;
                }

                const runtime = resolveAmmythRuntime();
                const cliPath = runtime.cliPath;

                if (!runtime.verifierCliPath) {
                    await vscode.window.showErrorMessage(
                        "Verification runtime is not configured."
                    );
                    return;
                }

                const verifierCliPath = runtime.verifierCliPath;

                let preparedRequest: {
                    protocolVersion: number;
                    requestID: string;
                    kind: string;
                    workspace: string;
                    expectedRevision: number;
                    evidenceSource: string;
                    evidenceSummary: string;
                    evidenceReference?: string;
                };

                try {
                    const stdout =
                        await runProvider(
                            runtime.adapterRuntime,
                            {
                                role: "verification",
                                cliPath,
                                verifierCliPath,
                                workspace,
                                workItemID: state.workItemID,
                                envelopePath: envelopeSelection[0].fsPath,
                                payloadPath: payloadSelection[0].fsPath
                            }
                        );

                    preparedRequest =
                        JSON.parse(stdout) as typeof preparedRequest;
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        `Verification preparation failed: ${message}`
                    );
                    return;
                }

                if (
                    preparedRequest.kind !== "record_evidence" ||
                    preparedRequest.workspace !== workspace ||
                    !Number.isInteger(
                        preparedRequest.expectedRevision
                    ) ||
                    typeof preparedRequest.evidenceSource !== "string" ||
                    preparedRequest.evidenceSource.trim().length === 0 ||
                    typeof preparedRequest.evidenceSummary !== "string" ||
                    preparedRequest.evidenceSummary.trim().length === 0 ||
                    typeof preparedRequest.requestID !== "string" ||
                    preparedRequest.requestID.trim().length === 0
                ) {
                    await vscode.window.showErrorMessage(
                        "Verification provider returned an invalid request."
                    );
                    return;
                }

                const maxSummaryLength = 2000;

                const previewSummary =
                    preparedRequest.evidenceSummary.length >
                    maxSummaryLength
                        ? (
                            preparedRequest.evidenceSummary.slice(
                                0,
                                maxSummaryLength
                            ) +
                            "\n\n[Preview truncated; full value will be submitted.]"
                        )
                        : preparedRequest.evidenceSummary;

                const confirmation =
                    await vscode.window.showInformationMessage(
                        "Submit prepared verification evidence?",
                        {
                            modal: true,
                            detail: [
                                `Workspace: ${workspace}`,
                                `WorkItem: ${state.workItemID}`,
                                `Envelope: ${envelopeSelection[0].fsPath}`,
                                `Payload: ${payloadSelection[0].fsPath}`,
                                `Expected revision: ${preparedRequest.expectedRevision}`,
                                `Source: ${preparedRequest.evidenceSource}`,
                                "",
                                previewSummary,
                                "",
                                `Reference: ${preparedRequest.evidenceReference ?? "—"}`
                            ].join("\n")
                        },
                        "Submit Evidence"
                    );

                if (confirmation !== "Submit Evidence") {
                    return;
                }

                try {
                    const stdout = await runAmmythCLI(
                        cliPath,
                        preparedRequest
                    );

                    const response =
                        JSON.parse(stdout) as AmmythWorkState;

                    workStateProvider.setState(response);

                    await vscode.window.showInformationMessage(
                        `Verification recorded. Revision ${response.revision ?? "—"}, evidence ${response.evidenceCount ?? "—"}.`
                    );
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    await vscode.window.showErrorMessage(
                        message
                    );
                }
            }
        );

    const proposeAssignmentCommand = vscode.commands.registerCommand(
        "ammyth.proposeAssignment",
        async () => {
            await vscode.commands.executeCommand(
                "workbench.view.extension.ammyth"
            );

            await vscode.commands.executeCommand(
                `${AssignmentProposalViewProvider.viewType}.focus`
            );
        }
    );

    const visibilityListener =
        workStateView.onDidChangeVisibility(
            async () => {
                if (workStateView.visible) {
                    await loadCurrentWorkState();
                }
            }
        );

    const workspaceChangeListener =
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            clearWorkspaceTarget();
        });

    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );

    statusBarItem.text = "$(pulse) Ammyth";
    statusBarItem.tooltip =
        "Ammyth — Work Control for AI Agents";
    statusBarItem.command = "ammyth.inspectCurrentWork";
    statusBarItem.show();

    context.subscriptions.push(
        disposable,
        statusBarItem,
        workStateView,
        refreshCurrentWork,
        proposeAssignmentCommand,
        visibilityListener,
        assignmentProposalView,
        recordResultView,
        recordEvidenceView,
        reviewResultView,
        initializeWorkStateCommand,
        importEvidenceCommand,
        importAssignmentCommand,
        importVerificationEvidenceCommand,
        workspaceChangeListener
    );
}

export function deactivate(): void {}