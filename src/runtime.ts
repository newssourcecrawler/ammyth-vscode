import * as vscode from "vscode";
import {
    ResolvedRuntime,
    resolveRuntimeFromRoot
} from "./runtimeCore";

export { ResolvedRuntime } from "./runtimeCore";

export function resolveAmmythRuntime(): ResolvedRuntime {
    const configuration =
        vscode.workspace.getConfiguration("ammyth");

    const runtimePath =
        configuration
            .get<string>("runtimePath", "")
            .trim();

    const cliPath =
        configuration
            .get<string>("cliPath", "")
            .trim();

    if (runtimePath.length === 0) {
        throw new Error(
            "Ammyth runtime is not configured. " +
            "Set ammyth.runtimePath to the installed Ammyth runtime directory."
        );
    }

    return resolveRuntimeFromRoot(
        runtimePath,
        cliPath
    );
}