import * as vscode from "vscode";
import { findRetainedWorkspaceIndex } from "./workspaceTargetCore";

let retainedWorkspaceUri: vscode.Uri | undefined;

export async function getWorkspaceTarget(): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];

    if (folders.length === 0) {
        await vscode.window.showErrorMessage(
            "Ammyth requires an open workspace."
        );
        retainedWorkspaceUri = undefined;
        return undefined;
    }

    if (retainedWorkspaceUri) {
        const retainedIndex = findRetainedWorkspaceIndex(
            folders.map(folder => folder.uri.toString()),
            retainedWorkspaceUri.toString()
        );

        if (retainedIndex !== undefined) {
            return folders[retainedIndex].uri.fsPath;
        }

        retainedWorkspaceUri = undefined;
    }

    if (folders.length === 1) {
        retainedWorkspaceUri = folders[0].uri;
        return folders[0].uri.fsPath;
    }

    const selected = await vscode.window.showQuickPick(
        folders.map(folder => ({
            label: folder.name,
            description: folder.uri.fsPath,
            uri: folder.uri
        })),
        {
            title: "Select Ammyth workspace",
            placeHolder:
                "Choose the workspace Ammyth should operate on"
        }
    );

    if (!selected) {
        return undefined;
    }

    retainedWorkspaceUri = selected.uri;
    return selected.uri.fsPath;
}

export function clearWorkspaceTarget(): void {
    retainedWorkspaceUri = undefined;
}