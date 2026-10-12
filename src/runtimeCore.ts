import * as fs from "fs";
import * as path from "path";
import { AdapterRuntime } from "./adapters";

type ProviderRole =
    | "assignment"
    | "evidence"
    | "verification";

interface RuntimeManifest {
    runtimeVersion: number;
    cli: string;
    python?: string;
    providers?: Partial<Record<ProviderRole, string>>;
    components?: {
        assignment?: string;
        evidence?: string;
        verification?: string;
        verifier?: string;
    };

    // Runtime v1 compatibility. Keep current implementation
    // knowledge contained in this file.
    adapters?: {
        beaxEvidence?: string;
        pickleAssignment?: string;
        nubuckEvidence?: string;
    };

    nubuckCli?: string;
}

export interface ResolvedRuntime {
    rootPath: string;
    cliPath: string;
    adapterRuntime: AdapterRuntime;
    verifierCliPath?: string;
}

const CURRENT_RUNTIME_VERSION = 1;

const PROVIDERS = {
    assignment: "assignment.primary.v1",
    evidence: "evidence.primary.v1",
    verification: "verification.primary.v1"
} as const;

function requireString(
    value: unknown,
    field: string
): string {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw new Error(
            `Invalid Ammyth runtime manifest field: ${field}`
        );
    }

    return value.trim();
}

function requireObject(
    value: unknown
): Record<string, unknown> {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(
            "Invalid Ammyth runtime manifest."
        );
    }

    return value as Record<string, unknown>;
}

function requireRuntimePath(
    rootPath: string,
    value: string
): string {
    if (path.isAbsolute(value)) {
        throw new Error(
            "Invalid Ammyth runtime component path."
        );
    }

    const root = path.resolve(rootPath);
    const resolved = path.resolve(root, value);

    const relative = path.relative(
        root,
        resolved
    );

    if (
        relative.length === 0 ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error(
            "Invalid Ammyth runtime component path."
        );
    }

    return resolved;
}

function requireFile(
    filePath: string,
    label = "Required Ammyth runtime component"
): string {
    try {
        const stat = fs.statSync(filePath);

        if (!stat.isFile()) {
            throw new Error(
                `${label} is invalid.`
            );
        }

        return filePath;
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === `${label} is invalid.`
        ) {
            throw error;
        }

        throw new Error(
            `${label} is missing or inaccessible.`
        );
    }
}

function requireExecutable(
    filePath: string,
    label = "Required Ammyth runtime component"
): string {
    requireFile(filePath, label);

    try {
        fs.accessSync(
            filePath,
            fs.constants.X_OK
        );

        return filePath;
    } catch {
        throw new Error(
            `${label} is not executable.`
        );
    }
}

function readManifest(
    manifestPath: string
): RuntimeManifest {
    let source: string;

    try {
        source = fs.readFileSync(
            manifestPath,
            "utf8"
        );
    } catch {
        throw new Error(
            "Ammyth runtime manifest is inaccessible."
        );
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(source);
    } catch {
        throw new Error(
            "Ammyth runtime manifest is malformed."
        );
    }

    const value = requireObject(parsed);

    if (
        value.runtimeVersion !==
        CURRENT_RUNTIME_VERSION
    ) {
        throw new Error(
            "Ammyth runtime version is unsupported."
        );
    }

    return value as unknown as RuntimeManifest;
}

function readProvider(
    manifest: RuntimeManifest,
    role: ProviderRole
): string {
    const selected =
        manifest.providers?.[role];

    if (selected !== undefined) {
        return requireString(
            selected,
            `providers.${role}`
        );
    }

    return PROVIDERS[role];
}

function resolveProviderPath(
    manifest: RuntimeManifest,
    rootPath: string,
    role: ProviderRole
): string {
    const provider = readProvider(
        manifest,
        role
    );

    switch (role) {
        case "assignment": {
            if (
                provider !==
                PROVIDERS.assignment
            ) {
                throw new Error(
                    "Unsupported Ammyth assignment provider."
                );
            }

            return requireExecutable(
                requireRuntimePath(
                    rootPath,
                    requireString(
                        manifest.components?.assignment ??
                            manifest.adapters?.pickleAssignment,
                        "assignment provider"
                    )
                )
            );
        }

        case "evidence": {
            if (
                provider !== PROVIDERS.evidence
            ) {
                throw new Error(
                    "Unsupported Ammyth evidence provider."
                );
            }

            return requireExecutable(
                requireRuntimePath(
                    rootPath,
                    requireString(
                        manifest.components?.evidence ??
                            manifest.adapters?.beaxEvidence,
                        "evidence provider"
                    )
                )
            );
        }

        case "verification": {
            if (
                provider !==
                PROVIDERS.verification
            ) {
                throw new Error(
                    "Unsupported Ammyth verification provider."
                );
            }

            return requireExecutable(
                requireRuntimePath(
                    rootPath,
                    requireString(
                        manifest.components?.verification ??
                            manifest.adapters?.nubuckEvidence,
                        "verification provider"
                    )
                )
            );
        }
    }
}

export function resolveRuntimeFromRoot(
    configuredRoot: string,
    configuredCliPath = ""
): ResolvedRuntime {
    if (configuredRoot.trim().length === 0) {
        throw new Error(
            "Ammyth runtime is not configured."
        );
    }

    const rootPath =
        path.resolve(configuredRoot);

    const manifestPath =
        path.join(
            rootPath,
            "manifest.json"
        );

    requireFile(
        manifestPath,
        "Ammyth runtime manifest"
    );

    const manifest =
        readManifest(manifestPath);

    const cliPath =
        requireExecutable(
            requireRuntimePath(
                rootPath,
                requireString(
                    manifest.cli,
                    "cli"
                )
            ),
            "Ammyth CLI"
        );

    const assignmentProviderPath =
        resolveProviderPath(
            manifest,
            rootPath,
            "assignment"
        );

    const evidenceProviderPath =
        resolveProviderPath(
            manifest,
            rootPath,
            "evidence"
        );

    const verificationProviderPath =
        resolveProviderPath(
            manifest,
            rootPath,
            "verification"
        );

    const effectiveCliPath =
        configuredCliPath.trim().length > 0
            ? requireExecutable(
                path.resolve(
                    configuredCliPath
                ),
                "Configured Ammyth CLI"
            )
            : cliPath;

    const verifierValue =
        manifest.components?.verifier ??
        manifest.nubuckCli;

    const verifierCliPath =
        typeof verifierValue === "string" &&
        verifierValue.trim().length > 0
            ? requireExecutable(
                requireRuntimePath(
                    rootPath,
                    verifierValue.trim()
                )
            )
            : undefined;

    return {
        rootPath,
        cliPath: effectiveCliPath,
        adapterRuntime: {
            evidenceProviderPath,
            assignmentProviderPath,
            verificationProviderPath
        },
        verifierCliPath
    };
}