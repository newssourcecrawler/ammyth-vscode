const assert = require("node:assert/strict");
const test = require("node:test");

const {
    findRetainedWorkspaceIndex
} = require("../out/workspaceTargetCore");

test("returns undefined when there is no retained workspace", () => {
    assert.equal(
        findRetainedWorkspaceIndex(
            ["file:///a", "file:///b"],
            undefined
        ),
        undefined
    );
});

test("finds retained workspace", () => {
    assert.equal(
        findRetainedWorkspaceIndex(
            ["file:///a", "file:///b"],
            "file:///b"
        ),
        1
    );
});

test("returns undefined when retained workspace disappeared", () => {
    assert.equal(
        findRetainedWorkspaceIndex(
            ["file:///a", "file:///b"],
            "file:///c"
        ),
        undefined
    );
});

test("distinguishes exact workspace URIs", () => {
    assert.equal(
        findRetainedWorkspaceIndex(
            ["file:///project", "file:///project-2"],
            "file:///project"
        ),
        0
    );
});