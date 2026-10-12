export function findRetainedWorkspaceIndex(
    folderUris: readonly string[],
    retainedUri: string | undefined
): number | undefined {
    if (!retainedUri) {
        return undefined;
    }

    const index = folderUris.findIndex(
        folderUri => folderUri === retainedUri
    );

    return index >= 0 ? index : undefined;
}