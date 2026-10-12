
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
    resolveRuntimeFromRoot
} = require("../out/runtimeCore");

function makeRuntime(overrides = {}) {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "ammyth-runtime-")
    );

    fs.mkdirSync(path.join(root, "bin"));
    fs.mkdirSync(path.join(root, "tools"));

    fs.writeFileSync(
        path.join(root, "bin", "ammyth-cli"),
        ""
    );
    fs.chmodSync(
        path.join(root, "bin", "ammyth-cli"),
        0o755
    );

    for (const name of [
        "evidence_provider.py",
        "assignment_provider.py",
        "verification_provider.py"
    ]) {
        fs.writeFileSync(
            path.join(root, "tools", name),
            ""
        );
        fs.chmodSync(
            path.join(root, "tools", name),
            0o755
        );
    }

    fs.writeFileSync(
        path.join(root, "manifest.json"),
        JSON.stringify({
            runtimeVersion: 1,
            cli: "bin/ammyth-cli",
            python: "python3",
            components: {
                assignment:
                    "tools/assignment_provider.py",
                evidence:
                    "tools/evidence_provider.py",
                verification:
                    "tools/verification_provider.py",
                verifier:
                    "bin/verifier"
            },
            ...overrides,
            components: {
                assignment:
                    "tools/assignment_provider.py",
                evidence:
                    "tools/evidence_provider.py",
                verification:
                    "tools/verification_provider.py",
                verifier:
                    "bin/verifier",
                ...(overrides.components || {})
            }
        })
    );

    const verifierPath = path.join(
        root,
        "bin",
        "verifier"
    );
    fs.writeFileSync(verifierPath, "");
    fs.chmodSync(verifierPath, 0o755);

    return root;
}

test("resolves a valid runtime", () => {
    const root = makeRuntime();

    try {
        const runtime =
            resolveRuntimeFromRoot(root);

        assert.equal(runtime.rootPath, root);
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects missing manifest", () => {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "ammyth-runtime-")
    );

    try {
        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /manifest/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects malformed manifest", () => {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "ammyth-runtime-")
    );

    try {
        fs.writeFileSync(
            path.join(root, "manifest.json"),
            "{broken"
        );

        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /manifest is malformed/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects missing adapter", () => {
    const root = makeRuntime();

    try {
        fs.unlinkSync(
            path.join(
                root,
                "tools",
                "evidence_provider.py"
            )
        );

        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /Required Ammyth runtime component/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects provider path traversal", () => {
    const root = makeRuntime({
        components: {
            evidence: "../outside.py"
        }
    });

    try {
        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /Invalid Ammyth runtime component path/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects absolute provider path", () => {
    const root = makeRuntime({
        components: {
            evidence: "/tmp/evidence.py"
        }
    });

    try {
        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /Invalid Ammyth runtime component path/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("rejects unknown provider id", () => {
    const root = makeRuntime({
        providers: {
            evidence: "evidence.unknown.v1"
        }
    });

    try {
        assert.throws(
            () => resolveRuntimeFromRoot(root),
            /Unsupported Ammyth evidence provider/
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("accepts current provider ids", () => {
    const root = makeRuntime({
        providers: {
            assignment: "assignment.primary.v1",
            evidence: "evidence.primary.v1",
            verification: "verification.primary.v1"
        }
    });

    try {
        const runtime =
            resolveRuntimeFromRoot(root);

        assert.ok(
            runtime.adapterRuntime
                .assignmentProviderPath
        );
        assert.ok(
            runtime.adapterRuntime
                .evidenceProviderPath
        );
        assert.ok(
            runtime.adapterRuntime
                .verificationProviderPath
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("allows configured cli outside runtime root", () => {
    const root = makeRuntime();
    const externalDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "ammyth-cli-")
    );
    const externalCli = path.join(
        externalDir,
        "ammyth-cli"
    );
    fs.writeFileSync(externalCli, "");
    fs.chmodSync(externalCli, 0o755);

    try {
        const runtime = resolveRuntimeFromRoot(
            root,
            externalCli
        );

        assert.equal(
            runtime.cliPath,
            path.resolve(externalCli)
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
        fs.rmSync(externalDir, {
            recursive: true,
            force: true
        });
    }
});

test("accepts legacy runtime component keys", () => {
    const root = makeRuntime();

    fs.writeFileSync(
        path.join(root, "manifest.json"),
        JSON.stringify({
            runtimeVersion: 1,
            cli: "bin/ammyth-cli",
            python: "python3",
            adapters: {
                beaxEvidence:
                    "tools/evidence_provider.py",
                pickleAssignment:
                    "tools/assignment_provider.py",
                nubuckEvidence:
                    "tools/verification_provider.py"
            },
            nubuckCli: "bin/verifier"
        })
    );

    try {
        const runtime =
            resolveRuntimeFromRoot(root);

        assert.ok(
            runtime.adapterRuntime
                .assignmentProviderPath
        );
        assert.ok(
            runtime.adapterRuntime
                .evidenceProviderPath
        );
        assert.ok(
            runtime.adapterRuntime
                .verificationProviderPath
        );
        assert.ok(runtime.verifierCliPath);
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});

test("prefers neutral components over legacy keys", () => {
    const root = makeRuntime();

    const alternateEvidence = path.join(
        root,
        "tools",
        "alternate_evidence.py"
    );
    fs.writeFileSync(
        alternateEvidence,
        ""
    );
    fs.chmodSync(alternateEvidence, 0o755);

    const manifestPath =
        path.join(root, "manifest.json");

    const manifest = JSON.parse(
        fs.readFileSync(
            manifestPath,
            "utf8"
        )
    );

    manifest.adapters = {
        beaxEvidence:
            "tools/alternate_evidence.py",
        pickleAssignment:
            "tools/assignment_provider.py",
        nubuckEvidence:
            "tools/verification_provider.py"
    };

    fs.writeFileSync(
        manifestPath,
        JSON.stringify(manifest)
    );

    try {
        const runtime =
            resolveRuntimeFromRoot(root);

        assert.equal(
            runtime.adapterRuntime
                .evidenceProviderPath,
            path.join(
                root,
                "tools",
                "evidence_provider.py"
            )
        );
    } finally {
        fs.rmSync(root, {
            recursive: true,
            force: true
        });
    }
});