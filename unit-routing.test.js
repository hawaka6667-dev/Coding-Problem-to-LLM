/*
 * Unit tests for platform routing, prompt assembly, and extension commands.
 * Website-specific selectors belong in browser-smoke.test.js.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadWorker() {
    const listeners = {};
    const chrome = {
        action: { onClicked: { addListener: listener => { listeners.clicked = listener; } } },
        commands: { onCommand: { addListener: listener => { listeners.command = listener; } } },
        runtime: { onMessage: { addListener: listener => { listeners.message = listener; } } },
        scripting: {
            executeScript: async () => [{ result: true }]
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

test("recognizes DeepAI pages with common URL variants", () => {
    const { context } = loadWorker();
    const result = vm.runInContext(
        "LLM_PROVIDERS.find(provider => provider.name === 'DeepAI').match('https://www.deepai.org/chat') && LLM_PROVIDERS.find(provider => provider.name === 'DeepAI').match('https://deepai.org/')",
        context
    );
    assert.equal(result, true);
});

test("does not treat malformed or unrelated URLs as LLM pages", () => {
    const { context } = loadWorker();
    const result = vm.runInContext(
        "LLM_PROVIDERS.some(provider => provider.match('https://deepai.org.evil.example/')) || LLM_PROVIDERS.some(provider => provider.match('not a URL'))",
        context
    );
    assert.equal(result, false);
});

test("rejects unsupported pages", () => {
    const { context } = loadWorker();
    assert.throws(
        () => vm.runInContext("getPlatform('https://example.com/')", context),
        /not a supported coding exercise page/
    );
});

test("rejects view-source pages", () => {
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

test("uses a content script for the Exercism Ctrl+Enter shortcut", () => {
    const manifest = JSON.parse(fs.readFileSync(
        require("node:path").join(__dirname, "manifest.json"),
        "utf8"
    ));
    assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
    assert.equal(manifest.commands["exercism-test-submit"], undefined);
});

test("registers the extension icon", () => {
    const manifest = JSON.parse(fs.readFileSync(
        require("node:path").join(__dirname, "manifest.json"),
        "utf8"
    ));
    assert.equal(manifest.icons["128"], "icons/icon.svg");
    assert.equal(manifest.action.default_icon["32"], "icons/icon.svg");
    assert.equal(fs.existsSync(
        require("node:path").join(__dirname, manifest.icons["128"])
    ), true);
});

test("builds a prompt with LeetCode context and source", () => {
    const { context } = loadWorker();
    const prompt = vm.runInContext(
        "buildPrompt({ platform: 'LeetCode', title: 'Memoize II', description: 'Use === identity.', source: 'function memoize(fn) {}' })",
        context
    );

    assert.match(prompt, /Memoize II/);
    assert.match(prompt, /Use === identity\./);
    assert.match(prompt, /function memoize\(fn\) \{\}/);
    assert.doesNotMatch(prompt, /你是我的编程助手/);
    assert.doesNotMatch(prompt, /题目描述：|当前代码：|```javascript/);
    assert.doesNotMatch(prompt, /最近一次运行\/提交反馈/);
});

test("adds submission feedback to the prompt when available", () => {
    const { context } = loadWorker();
    const prompt = vm.runInContext(
        "buildPrompt({ platform: 'LeetCode', source: 'const answer = 1;', feedback: 'Wrong Answer\\nExpected: 2\\nOutput: 1' })",
        context
    );

    assert.match(prompt, /Expected: 2/);
    assert.doesNotMatch(prompt, /最近一次运行\/提交反馈/);
});
