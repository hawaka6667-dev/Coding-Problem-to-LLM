//
// （llm dont touch here）
// 设计文档
//
// 作用   让llm获得充分的网站题目信息
//
// 优化   修扩展错误；简化；上滑又下滑（静默）
//
// 跨网站自动测试js     参数：延迟、llm是否获得充分信息（我手动填）
//
// issue
//   扩展到neet codewar
//   针对专门网页进行优化，先把无关又多的东西弄掉
//

const EXERCISM_URL =
    /^https:\/\/exercism\.org\/tracks\/[^/]+\/exercises\/[^/]+\/edit/;

const LEETCODE_URL =
    /^https:\/\/leetcode\.com\/problems\/[^/]+\/?/;

const DEEPSEEK_URL =
    /^https:\/\/(chat\.)?deepseek\.com\//;

const INPUT_SELECTORS = [
    "textarea",
    '[contenteditable="true"]',
    '[role="textbox"]'
];

function pageUrl(url) {
    return typeof url === "string" && url.startsWith("view-source:")
        ? url.slice("view-source:".length)
        : url;
}

function isViewSourceUrl(url) {
    return typeof url === "string" && url.startsWith("view-source:");
}

// ============================================================
// Utility
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function keyTap(tabId, key) {
    for (const type of ["keyDown", "keyUp"]) {
        await sendCommand(tabId, "Input.dispatchKeyEvent", { type, key });
    }
}

async function scrollUp(tabId, amount = 50) {
    await sendCommand(
        tabId,
        "Input.dispatchMouseEvent",
        {
            type: "mouseWheel",
            x: 500,
            y: 500,
            deltaY: -amount,
            deltaX: 0
        }
    );
}

async function sendCommand(tabId, method, params = {}) {
    return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function evaluatePage(tabId, expression) {
    const result = await sendCommand(tabId, "Runtime.evaluate", {
        expression,
        returnByValue: true
    });

    if (result?.exceptionDetails) {
        const details = result.exceptionDetails;
        throw new Error(
            details.exception?.description ||
            details.text ||
            "Runtime.evaluate failed."
        );
    }

    return result?.result?.value;
}

async function withDebugger(tabId, task) {
    await chrome.debugger.attach({ tabId }, "1.3");
    try {
        return await task();
    } finally {
        try {
            await chrome.debugger.detach({ tabId });
        } catch (_) {
            // The tab may already be closed or detached.
        }
    }
}


// ============================================================
// Platform Adapters
// ============================================================

const ExercismAdapter = {

    name: "Exercism",

    match(url) {
        return EXERCISM_URL.test(url);
    },

    async getSource(tabId) {

        const value = await evaluatePage(tabId, `
                        (() => {

                            const editor =
                                document.querySelector(
                                    '[data-react-id="editor"]'
                                );

                            if (editor) {
                                const raw = editor.getAttribute("data-react-data");

                                if (raw) {
                                    try {
                                        const data = JSON.parse(raw);
                                        const files = data.default_files;

                                        if (Array.isArray(files) && files.length > 0) {
                                            return { found: true, method: "Exercism data", files };
                                        }
                                    } catch (_) {
                                        // Try the rendered editor below.
                                    }
                                }
                            }

                            const candidates = [
                                ...document.querySelectorAll(".cm-content"),
                                ...document.querySelectorAll("textarea"),
                                ...document.querySelectorAll('[contenteditable="true"]')
                            ];

                            for (const element of candidates) {
                                const source = element.value || element.innerText || element.textContent;
                                const visible = element.offsetWidth > 0 && element.offsetHeight > 0;

                                if (visible && typeof source === "string" && source.trim()) {
                                    return {
                                        found: true,
                                        method: "rendered editor",
                                        files: [{ filename: "current-source", content: source }]
                                    };
                                }
                            }

                            return {
                                found: false,
                                reason: "Exercism editor is not rendered yet"
                            };

                        })()
                    `);

        if (!value?.found) {
            throw new Error(
                "Could not extract Exercism editor data: " +
                value?.reason
            );
        }

        const source =
            value.files
                .map(file =>
                    `// ${file.filename}\n${file.content}`
                )
                .join("\n\n");

        console.log(
            "[Exercism] source extracted via",
            value.method,
            value.files.length,
            "files,",
            source.length,
            "characters"
        );

        return source;
    }
};


const LeetCodeAdapter = {

    name: "LeetCode",

    match(url) {
        return LEETCODE_URL.test(url);
    },

    async getSource(tabId) {

        const value = await evaluatePage(tabId, `
                        (() => {

                            if (
                                window.monaco &&
                                window.monaco.editor
                            ) {

                                const models =
                                    window.monaco.editor.getModels();

                                for (const model of models) {

                                    const source =
                                        model.getValue();

                                    if (
                                        typeof source === "string" &&
                                        source.trim()
                                    ) {
                                        return {
                                            found: true,
                                            method: "Monaco",
                                            source
                                        };
                                    }
                                }
                            }

                            const cmContent =
                                document.querySelector(
                                    ".cm-editor .cm-content"
                                );

                            if (cmContent) {

                                const source =
                                    cmContent.innerText;

                                if (
                                    typeof source === "string" &&
                                    source.trim()
                                ) {
                                    return {
                                        found: true,
                                        method: "CodeMirror",
                                        source
                                    };
                                }
                            }

                            const textareas =
                                document.querySelectorAll("textarea");

                            for (const textarea of textareas) {

                                if (
                                    textarea.offsetWidth > 0 &&
                                    textarea.offsetHeight > 0 &&
                                    textarea.value?.trim()
                                ) {
                                    return {
                                        found: true,
                                        method: "textarea",
                                        source: textarea.value
                                    };
                                }
                            }

                            const editables =
                                document.querySelectorAll(
                                    '[contenteditable="true"]'
                                );

                            for (const element of editables) {

                                if (
                                    element.offsetWidth > 0 &&
                                    element.offsetHeight > 0 &&
                                    element.innerText?.trim()
                                ) {
                                    return {
                                        found: true,
                                        method: "contenteditable",
                                        source: element.innerText
                                    };
                                }
                            }

                            return {
                                found: false,
                                reason: "editor not found"
                            };

                        })()
                    `);

        if (!value?.found) {
            throw new Error(
                "Could not extract LeetCode editor source: " +
                value?.reason
            );
        }

        console.log(
            "[LeetCode] source extracted:",
            value.method,
            value.source.length,
            "characters"
        );

        return value.source;
    }
};


// ============================================================
// Platform Registry
// ============================================================

const PLATFORMS = [
    ExercismAdapter,
    LeetCodeAdapter
];

function getPlatform(url) {

    if (isViewSourceUrl(url)) {
        throw new Error(
            "Open the normal Exercism page instead of view-source:; Chrome does not allow extensions to attach to view-source pages."
        );
    }

    const normalizedUrl = pageUrl(url);

    const platform =
        PLATFORMS.find(platform =>
            platform.match(normalizedUrl)
        );

    if (!platform) {
        throw new Error(
            "Current page is not a supported coding exercise page."
        );
    }

    return platform;
}


// ============================================================
// DeepSeek
// ============================================================

async function findDeepSeekTab() {

    const tabs =
        await chrome.tabs.query({});

    for (const tab of tabs) {

        if (
            tab.url &&
            DEEPSEEK_URL.test(tab.url)
        ) {
            return tab;
        }
    }

    throw new Error(
        "DeepSeek tab not found."
    );
}


async function focusDeepSeekInput(tabId) {
    const found = await evaluatePage(tabId, `
                    (() => {
                        for (const selector of ${JSON.stringify(INPUT_SELECTORS)}) {
                            for (const element of document.querySelectorAll(selector)) {
                                if (element.offsetWidth > 0 && element.offsetHeight > 0) {
                                    element.focus();
                                    return true;
                                }
                            }
                        }

                        return false;

                    })()
                `);

    return found === true;
}


async function waitForDeepSeekInput(
    tabId,
    timeout = 3000
) {

    const start = performance.now();

    while (
        performance.now() - start < timeout
    ) {

        if (
            await focusDeepSeekInput(tabId)
        ) {
            return;
        }

        await sleep(100);
    }

    throw new Error(
        "DeepSeek input not found."
    );
}


async function insertText(tabId, text) {

    await sendCommand(tabId, "Input.insertText", { text });
}


// ============================================================
// Main Workflow
// ============================================================

let workflowPromise = null;

async function runWorkflow() {

    if (workflowPromise) {
        console.warn("[workflow] Already running; ignoring duplicate trigger.");
        return workflowPromise;
    }

    workflowPromise = runWorkflowOnce();

    try {
        return await workflowPromise;
    } finally {
        workflowPromise = null;
    }
}

async function runWorkflowOnce() {

    const totalStart =
        performance.now();

    function mark(label, start) {
        console.log(
            `[profiler] ${label}:`,
            Math.round(
                performance.now() - start
            ),
            "ms"
        );
    }


    // Current tab

    let start = performance.now();

    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

    const currentTab = tabs[0];

    mark("tabs.query", start);

    if (!currentTab?.id) {
        throw new Error(
            "Current tab not found."
        );
    }


    // Platform

    const platform =
        getPlatform(currentTab.url);

    console.log(
        "[workflow] platform:",
        platform.name
    );


    // Exercise page

    start = performance.now();

    const source = await withDebugger(currentTab.id, async () => {
        start = performance.now();
        const result = await platform.getSource(currentTab.id);
        mark(`${platform.name}.getSource`, start);
        console.log("[workflow] source:", result.length, "characters");
        return result;
    });


    // DeepSeek

    start = performance.now();

    const deepSeekTab =
        await findDeepSeekTab();

    mark(
        "findDeepSeekTab",
        start
    );


    start = performance.now();

    await chrome.tabs.update(
        deepSeekTab.id,
        { active: true }
    );

    mark(
        "activate DeepSeek",
        start
    );


    start = performance.now();

    await withDebugger(deepSeekTab.id, async () => {
        // Input

        start = performance.now();

        await waitForDeepSeekInput(
            deepSeekTab.id
        );

        mark(
            "waitForDeepSeekInput",
            start
        );


        // Insert

        start = performance.now();

        await insertText(
            deepSeekTab.id,
            source
        );

        mark(
            `insertText (${source.length} chars)`,
            start
        );


        // Enter

        start = performance.now();

        await keyTap(
            deepSeekTab.id,
            "Enter"
        );

        mark(
            "Enter",
            start
        );


        // Scroll

        start = performance.now();

        await scrollUp(
            deepSeekTab.id,
            50
        );

        mark(
            "scroll",
            start
        );

    });


    console.log(
        "[profiler] TOTAL:",
        Math.round(
            performance.now() - totalStart
        ),
        "ms"
    );
}


// ============================================================
// Action button
// ============================================================

chrome.action.onClicked.addListener(
    async () => {

        try {
            await runWorkflow();
        } catch (error) {
            console.error(
                "[workflow] ERROR:",
                error
            );
        }
    }
);


// ============================================================
// Command
// ============================================================

chrome.commands.onCommand.addListener(
    async command => {

        if (
            command !== "run-workflow"
        ) {
            return;
        }

        try {
            await runWorkflow();
        } catch (error) {
            console.error(
                "[workflow] ERROR:",
                error
            );
        }
    }
);