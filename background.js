//
//issue（llm dont touch here）
//
//修扩展错误；简化
//
//扩展到leetcode
//针对专门网页进行优化
//
//
const EXERCISM_URL =
    /^https:\/\/exercism\.org\/tracks\/[^/]+\/exercises\/[^/]+\/edit/;

const DEEPSEEK_URL =
    /^https:\/\/(chat\.)?deepseek\.com\//;


// ============================================================
// Utility
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// CDP keyboard
// ============================================================

async function keyTap(tabId, key, code, modifiers = 0) {

    const target = { tabId };

    await chrome.debugger.sendCommand(
        target,
        "Input.dispatchKeyEvent",
        {
            type: "keyDown",
            key,
            code,
            modifiers
        }
    );

    await chrome.debugger.sendCommand(
        target,
        "Input.dispatchKeyEvent",
        {
            type: "keyUp",
            key,
            code,
            modifiers
        }
    );
}


// ============================================================
// CDP mouse wheel
// ============================================================

async function scrollUp(tabId, amount = 300) {

    await chrome.debugger.sendCommand(
        { tabId },
        "Input.dispatchMouseEvent",
        {
            type: "mouseWheel",
            x: 500,
            y: 500,
            deltaX: 0,
            deltaY: -amount
        }
    );

    console.log(
        "[workflow] scrolled up:",
        amount
    );
}


// ============================================================
// Get Exercism HTML
// ============================================================

async function getPageSource(tabId) {

    console.log(
        "[workflow] fetching original HTML"
    );

    const result =
        await chrome.debugger.sendCommand(
            { tabId },
            "Runtime.evaluate",
            {
                expression: `
                    fetch(location.href, {
                        credentials: "include"
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(
                                "HTTP " + response.status
                            );
                        }

                        return response.text();
                    })
                `,
                awaitPromise: true,
                returnByValue: true
            }
        );


    if (result?.exceptionDetails) {

        const description =
            result.exceptionDetails.exception
                ?.description ||
            result.exceptionDetails.text ||
            "Runtime.evaluate failed.";

        throw new Error(description);
    }


    const source =
        result?.result?.value;


    if (
        typeof source !== "string" ||
        !source.trim()
    ) {
        throw new Error(
            "Page source is empty."
        );
    }


    return source;
}


// ============================================================
// Find DeepSeek
// ============================================================

async function findDeepSeekTab() {

    const tabs = await chrome.tabs.query({});

    return tabs.find(tab =>
        tab.url &&
        DEEPSEEK_URL.test(tab.url)
    );
}


// ============================================================
// Find DeepSeek input
// ============================================================

async function focusDeepSeekInput(tabId) {

    const result =
        await chrome.debugger.sendCommand(
            { tabId },
            "Runtime.evaluate",
            {
                expression: `
                    (() => {

                        const selectors = [
                            'textarea',
                            '[contenteditable="true"]',
                            '[role="textbox"]'
                        ];

                        for (const selector of selectors) {

                            const elements =
                                document.querySelectorAll(
                                    selector
                                );

                            for (const element of elements) {

                                const rect =
                                    element.getBoundingClientRect();

                                const style =
                                    getComputedStyle(element);

                                if (
                                    rect.width > 0 &&
                                    rect.height > 0 &&
                                    style.visibility !== "hidden" &&
                                    style.display !== "none"
                                ) {

                                    element.focus();

                                    return {
                                        found: true,
                                        tag: element.tagName,
                                        contenteditable:
                                            element.getAttribute(
                                                "contenteditable"
                                            )
                                    };
                                }
                            }
                        }

                        return {
                            found: false
                        };
                    })()
                `,
                returnByValue: true
            }
        );


    return result?.result?.value;
}


// ============================================================
// Wait for DeepSeek input
// ============================================================

async function waitForDeepSeekInput(
    tabId,
    timeout = 3000
) {

    const start = Date.now();

    while (Date.now() - start < timeout) {

        const input =
            await focusDeepSeekInput(tabId);

        if (input?.found) {

            console.log(
                "[workflow] input found"
            );

            return input;
        }

        await sleep(100);
    }

    throw new Error(
        "Could not find DeepSeek input box."
    );
}


// ============================================================
// Insert text through CDP
// ============================================================

async function insertText(tabId, text) {

    console.log(
        "[workflow] inserting",
        text.length,
        "characters"
    );


    await chrome.debugger.sendCommand(
        { tabId },
        "Input.insertText",
        {
            text
        }
    );


    console.log(
        "[workflow] text inserted"
    );
}


// ============================================================
// Main workflow
// ============================================================

async function runWorkflow() {

    const totalStart = performance.now();

    function mark(label, start) {
        console.log(
            `[perf] ${label}:`,
            Math.round(performance.now() - start),
            "ms"
        );
    }


    // --------------------------------------------------------
    // 1. Current Exercism tab
    // --------------------------------------------------------

    let start = performance.now();

    const [currentTab] =
        await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        });

    mark("tabs.query", start);


    if (
        !currentTab?.id ||
        !currentTab.url
    ) {
        throw new Error(
            "No active tab."
        );
    }


    if (
        !EXERCISM_URL.test(
            currentTab.url
        )
    ) {
        throw new Error(
            "Current page is not an Exercism exercise /edit page."
        );
    }


    console.log(
        "[workflow] Exercism detected"
    );


    // --------------------------------------------------------
    // 2. Attach Exercism
    // --------------------------------------------------------

    start = performance.now();

    await chrome.debugger.attach(
        { tabId: currentTab.id },
        "1.3"
    );

    mark("Exercism debugger.attach", start);


    let source;


    try {

        // ----------------------------------------------------
        // 3. Get HTML
        // ----------------------------------------------------

        start = performance.now();

        source =
            await getPageSource(
                currentTab.id
            );

        mark("getPageSource", start);


        console.log(
            "[workflow] page source:",
            source.length,
            "characters"
        );

    } finally {

        start = performance.now();

        try {

            await chrome.debugger.detach({
                tabId: currentTab.id
            });

        } catch (_) {}

        mark("Exercism debugger.detach", start);
    }


    // --------------------------------------------------------
    // 4. Find DeepSeek
    // --------------------------------------------------------

    start = performance.now();

    const deepseek =
        await findDeepSeekTab();

    mark("findDeepSeekTab", start);


    if (!deepseek?.id) {

        throw new Error(
            "No DeepSeek tab found. Open DeepSeek first."
        );
    }


    console.log(
        "[workflow] DeepSeek tab:",
        deepseek.id
    );


    // --------------------------------------------------------
    // 5. Activate DeepSeek
    // --------------------------------------------------------

    start = performance.now();

    await chrome.tabs.update(
        deepseek.id,
        {
            active: true
        }
    );

    mark("activate DeepSeek", start);


    // --------------------------------------------------------
    // 6. Attach debugger
    // --------------------------------------------------------

    start = performance.now();

    await chrome.debugger.attach(
        { tabId: deepseek.id },
        "1.3"
    );

    mark("DeepSeek debugger.attach", start);


    try {

        // ----------------------------------------------------
        // 7. Find input
        // ----------------------------------------------------

        start = performance.now();

        await waitForDeepSeekInput(
            deepseek.id
        );

        mark("waitForDeepSeekInput", start);


        // ----------------------------------------------------
        // 8. Insert source
        // ----------------------------------------------------

        start = performance.now();

        await insertText(
            deepseek.id,
            source
        );

        mark(
            `insertText (${source.length} chars)`,
            start
        );


        // ----------------------------------------------------
        // 9. Enter
        // ----------------------------------------------------

        start = performance.now();

        await keyTap(
            deepseek.id,
            "Enter",
            "Enter"
        );

        mark("Enter", start);


        console.log(
            "[workflow] enter sent"
        );


        // ----------------------------------------------------
        // 10. Scroll
        // ----------------------------------------------------

        start = performance.now();

        await scrollUp(
            deepseek.id,
            70
        );

        mark("scroll", start);

    } finally {

        start = performance.now();

        try {

            await chrome.debugger.detach({
                tabId: deepseek.id
            });

        } catch (_) {}

        mark("DeepSeek debugger.detach", start);
    }


    console.log(
        "[perf] TOTAL:",
        Math.round(performance.now() - totalStart),
        "ms"
    );


    console.log(
        "[workflow] DONE"
    );
}

// ============================================================
// Extension button
// ============================================================

chrome.action.onClicked.addListener(
    async () => {

        try {

            await runWorkflow();

        } catch (error) {

            console.error(
                "[Exercism → DeepSeek]",
                error
            );
        }
    }
);


// ============================================================
// Ctrl+Shift+E
// ============================================================

chrome.commands.onCommand.addListener(
    async command => {

        if (
            command !==
            "run-workflow"
        ) {
            return;
        }


        try {

            await runWorkflow();

        } catch (error) {

            console.error(
                "[Exercism → DeepSeek]",
                error
            );
        }
    }
);