/*
 * Extension service worker: routes coding-page context to a nearby LLM and
 * coordinates website adapters and the Exercism test-submit action.
 */

const EXERCISM_URL =
    /^https:\/\/exercism\.org\/tracks\/[^/]+\/exercises\/[^/]+\/edit/;

const LEETCODE_URL =
    /^https:\/\/leetcode\.com\/problems\/[^/]+\/?/;

const DEEPSEEK_URL =
    /^https:\/\/(chat\.)?deepseek\.com\//;

const LLM_PROVIDERS = [
    {
        name: "DeepSeek",
        url: "https://chat.deepseek.com/",
        match: url => DEEPSEEK_URL.test(url)
    },
    {
        name: "ChatGPT",
        match: url => /^https:\/\/(chat\.)?openai\.com\//.test(url) ||
            /^https:\/\/chatgpt\.com\//.test(url)
    },
    {
        name: "Claude",
        match: url => /^https:\/\/claude\.ai\//.test(url)
    },
    {
        name: "Gemini",
        match: url => /^https:\/\/gemini\.google\.com\//.test(url)
    },
    {
        name: "DeepAI",
        match: url => /^https:\/\/(www\.)?deepai\.org\//.test(url)
    }
];

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
    await executePage(tabId, (pressedKey) => {
        const input = document.activeElement;
        if (!input) {
            return false;
        }

        for (const type of ["keydown", "keyup"]) {
            input.dispatchEvent(new KeyboardEvent(type, {
                key: pressedKey,
                code: pressedKey,
                bubbles: true,
                cancelable: true
            }));
        }

        return true;
    }, [key]);
}

async function scrollUp(tabId, amount = 50) {
    await executePage(tabId, scrollAmount => {
        window.scrollBy({ top: -scrollAmount, behavior: "auto" });
    }, [amount]);
}

async function executePage(tabId, func, args = [], world = "MAIN") {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        world,
        func,
        args
    });

    return results[0]?.result;
}


// ============================================================
// Platform Adapters
// ============================================================

const ExercismAdapter = {

    name: "Exercism",

    match(url) {
        return EXERCISM_URL.test(url);
    },

    async testAndSubmit(tabId) {
        const result = await executePage(tabId, () => {
            const buttons = [...document.querySelectorAll("button")]
                .filter(button =>
                    button.offsetWidth > 0 &&
                    button.offsetHeight > 0 &&
                    !button.disabled
                );
            const textOf = button => button.innerText.trim().toLowerCase();
            const testButton = buttons.find(button =>
                /run tests?|test/.test(textOf(button))
            );

            if (!testButton) {
                return { ok: false, reason: "Exercism test button not found." };
            }

            testButton.click();
            return { ok: true };
        });

        if (!result?.ok) {
            throw new Error(result?.reason || "Could not start Exercism tests.");
        }

        const continueStart = performance.now();
        while (performance.now() - continueStart < 5000) {
            const continued = await executePage(tabId, () => {
                const button = [...document.querySelectorAll("button")]
                    .find(candidate =>
                        candidate.offsetWidth > 0 &&
                        candidate.offsetHeight > 0 &&
                        !candidate.disabled &&
                        /continue without waiting/.test(
                            candidate.innerText.trim().toLowerCase()
                        )
                    );

                if (!button) {
                    return false;
                }

                button.click();
                return true;
            });

            if (continued) break;
            await sleep(100);
        }

        const submitted = await executePage(tabId, () => {
            const buttons = [...document.querySelectorAll("button")]
                .filter(button =>
                    button.offsetWidth > 0 &&
                    button.offsetHeight > 0 &&
                    !button.disabled
                );
            const submitButton = buttons.find(button =>
                /submit/.test(button.innerText.trim().toLowerCase())
            );

            if (!submitButton) {
                return { ok: false, reason: "Exercism submit button not found." };
            }

            submitButton.click();
            return { ok: true };
        });

        if (!submitted?.ok) {
            throw new Error(submitted?.reason || "Could not submit Exercism solution.");
        }
    },

    async getContext(tabId) {

        const value = await executePage(tabId, () => {

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

        });

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

        return {
            platform: this.name,
            source
        };
    }
};


const LeetCodeAdapter = {

    name: "LeetCode",

    match(url) {
        return LEETCODE_URL.test(url);
    },

    async getContext(tabId) {

        const value = await executePage(tabId, () => {

                            const textWithoutMedia = element => {
                                if (!element) {
                                    return "";
                                }
                                const copy = element.cloneNode(true);
                                copy.querySelectorAll(
                                    "img, picture, svg, video, audio, canvas, iframe"
                                ).forEach(media => media.remove());
                                return copy.innerText?.trim() || "";
                            };

                            const title =
                                textWithoutMedia(document.querySelector("h1")) ||
                                document.querySelector('meta[property="og:title"]')?.content?.trim() ||
                                document.title.trim();

                            const description =
                                document.querySelector('meta[name="description"]')?.content?.trim() ||
                                textWithoutMedia(document.querySelector('[data-track-load="description_content"]')) ||
                                textWithoutMedia(document.querySelector('div[class*="description__"]')) ||
                                "";

                            const feedbackKeywords = [
                                "Accepted",
                                "Wrong Answer",
                                "Runtime Error",
                                "Time Limit Exceeded",
                                "Compile Error",
                                "Memory Limit Exceeded",
                                "输入",
                                "输出",
                                "Expected"
                            ];
                            const feedbackCandidates = [
                                ...document.querySelectorAll(
                                    '[data-e2e-locator], [class*="result"], [class*="console"]'
                                )
                            ];
                            const feedback = feedbackCandidates
                                .map(element => ({
                                    text: textWithoutMedia(element),
                                    visible: element.offsetWidth > 0 && element.offsetHeight > 0
                                }))
                                .filter(candidate =>
                                    candidate.visible &&
                                    candidate.text.length > 0 &&
                                    candidate.text.length <= 12000 &&
                                    feedbackKeywords.some(keyword =>
                                        candidate.text.includes(keyword)
                                    )
                                )
                                .sort((left, right) => right.text.length - left.text.length)[0]?.text || "";

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
                                            source,
                                            title,
                                            description,
                                            feedback
                                        };
                                    }
                                }
                            }

                            const cmContent =
                                document.querySelector(
                                    ".cm-editor .cm-content"
                                );

                            if (cmContent) {

                                    const source = textWithoutMedia(cmContent);

                                if (
                                    typeof source === "string" &&
                                    source.trim()
                                ) {
                                    return {
                                        found: true,
                                        method: "CodeMirror",
                                        source,
                                        title,
                                        description,
                                        feedback
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
                                        source: textarea.value,
                                        title,
                                        description,
                                        feedback
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
                                        textWithoutMedia(element)
                                ) {
                                    return {
                                        found: true,
                                        method: "contenteditable",
                                        source: textWithoutMedia(element),
                                        title,
                                        description,
                                        feedback
                                    };
                                }
                            }

                            return {
                                found: false,
                                reason: "editor not found"
                            };

        });

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

        return {
            platform: this.name,
            title: value.title,
            description: value.description,
            feedback: value.feedback,
            source: value.source
        };
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

function buildPrompt(context) {
    const sections = [
        context.title || "",
        context.description || "",
        context.feedback || "",
        context.source || ""
    ];

    return sections.filter(Boolean).join("\n\n");
}

async function findLlmTab(currentTab) {
    const tabs = await chrome.tabs.query({ windowId: currentTab.windowId });
    const ordered = tabs
        .filter(tab => tab.id !== currentTab.id && typeof tab.index === "number")
        .sort((left, right) => right.index - left.index);
    const leftOfCurrent = ordered.filter(tab => tab.index < currentTab.index);
    const rightOfCurrent = ordered
        .filter(tab => tab.index > currentTab.index)
        .sort((left, right) => right.index - left.index);
    const candidates = [
        ...leftOfCurrent.sort((left, right) => right.index - left.index),
        ...rightOfCurrent
    ];

    for (const tab of candidates) {
        const provider = LLM_PROVIDERS.find(item => item.match(tab.url || ""));
        if (provider) {
            return { tab, provider };
        }
    }

    const provider = LLM_PROVIDERS[0];
    const tab = await chrome.tabs.create({
        windowId: currentTab.windowId,
        index: currentTab.index,
        url: provider.url,
        active: false
    });
    return { tab, provider };
}


async function focusDeepSeekInput(tabId) {
    const found = await executePage(tabId, selectors => {
        for (const selector of selectors) {
            for (const element of document.querySelectorAll(selector)) {
                if (element.offsetWidth > 0 && element.offsetHeight > 0) {
                    element.focus();
                    return true;
                }
            }
        }

        return false;
    }, [INPUT_SELECTORS]);

    return found === true;
}


async function waitForDeepSeekInput(
    tabId,
    timeout = 30000
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
    const inserted = await executePage(tabId, value => {
        const input = document.activeElement;
        if (!input) {
            return false;
        }

        if (input.isContentEditable) {
            input.focus();
            document.execCommand("selectAll", false);
            if (!document.execCommand("insertText", false, value)) {
                input.textContent = value;
            }
        } else if ("value" in input) {
            const prototype = Object.getPrototypeOf(input);
            const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
            if (descriptor?.set) {
                descriptor.set.call(input, value);
            } else {
                input.value = value;
            }
        } else {
            return false;
        }

        input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: value
        }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }, [text]);

    if (inserted !== true) {
        throw new Error("Could not insert text into DeepSeek input.");
    }
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

    const context = await platform.getContext(currentTab.id);
    const prompt = buildPrompt(context);
    mark(`${platform.name}.getSource`, start);
    console.log("[workflow] prompt:", prompt.length, "characters");


    // DeepSeek

    start = performance.now();

    const llm = await findLlmTab(currentTab);
    const deepSeekTab = llm.tab;

    mark(
        `find ${llm.provider.name}`,
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
    await waitForDeepSeekInput(deepSeekTab.id);
    mark("waitForDeepSeekInput", start);

    start = performance.now();
    await insertText(deepSeekTab.id, prompt);
    mark(`insertText (${prompt.length} chars)`, start);

    start = performance.now();
    await keyTap(deepSeekTab.id, "Enter");
    mark("Enter", start);

    start = performance.now();
    await scrollUp(deepSeekTab.id, 50);
    mark("scroll", start);


    console.log(
        "[profiler] TOTAL:",
        Math.round(
            performance.now() - totalStart
        ),
        "ms"
    );
}

async function runExercismTestSubmit() {
    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    const currentTab = tabs[0];
    if (!currentTab?.id) {
        throw new Error("Current tab not found.");
    }

    const platform = getPlatform(currentTab.url);
    if (typeof platform.testAndSubmit !== "function") {
        throw new Error("Test and submit is only supported on Exercism.");
    }

    await platform.testAndSubmit(currentTab.id);
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

        try {
            if (command === "run-workflow") {
                await runWorkflow();
            }
        } catch (error) {
            console.error(
                "[workflow] ERROR:",
                error
            );
        }
    }
);

chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "exercism-test-submit") {
        return;
    }

    runExercismTestSubmit().catch(error => {
        console.error("[exercism] test and submit ERROR:", error);
    });
});