const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadWorker() {
    const listeners = {};
    const chrome = {
        action: { onClicked: { addListener: listener => { listeners.clicked = listener; } } },
        commands: { onCommand: { addListener: listener => { listeners.command = listener; } } },
        debugger: {
            attach: async () => {},
            detach: async () => {},
            sendCommand: async () => ({ result: { value: true } })
        },
        tabs: {
            query: async () => [],
            update: async () => {}
        }
    };
    const context = vm.createContext({
        chrome,
        console,
        performance,
        setTimeout,
        clearTimeout
    });

    const source = fs.readFileSync(
        require("node:path").join(__dirname, "background.js"),
        "utf8"
    );
    vm.runInContext(source, context);
    return { context, listeners };
}

test("selects the Exercism adapter for exercise edit pages", () => {
    const { context } = loadWorker();
    const name = vm.runInContext(
        "getPlatform('https://exercism.org/tracks/c/exercises/hello-world/edit').name",
        context
    );
    assert.equal(name, "Exercism");
});

test("selects the LeetCode adapter for problem pages", () => {
    const { context } = loadWorker();
    const name = vm.runInContext(
        "getPlatform('https://leetcode.com/problems/two-sum/').name",
        context
    );
    assert.equal(name, "LeetCode");
});

test("rejects unsupported pages", () => {
    const { context } = loadWorker();
    assert.throws(
        () => vm.runInContext("getPlatform('https://example.com/')", context),
        /not a supported coding exercise page/
    );
});

test("rejects view-source pages before debugger access", () => {
    const { context } = loadWorker();
    assert.throws(
        () => vm.runInContext(
            "getPlatform('view-source:https://exercism.org/tracks/c/exercises/hello-world/edit')",
            context
        ),
        /Open the normal Exercism page instead of view-source/
    );
});

test("registers the manifest command name", () => {
    const { listeners } = loadWorker();
    assert.equal(typeof listeners.command, "function");
});
