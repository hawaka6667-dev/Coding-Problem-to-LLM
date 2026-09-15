//
// issue（llm dont touch here）
//
// 设计思路   让llm获得充分的网站题目信息
//
// 优化       修扩展错误；简化；                    上滑又下滑（静默）
//
// 扩展到neet codewar
// 针对专门网页进行优化，先把无关又多的东西弄掉
//  
// 
//


const EXERCISM_URL =
    /^https:\/\/exercism\.org\/tracks\/[^/]+\/exercises\/[^/]+\/edit/;

const LEETCODE_URL =
    /^https:\/\/leetcode\.com\/problems\/[^/]+\/?/;

const DEEPSEEK_URL =
    /^https:\/\/(chat\.)?deepseek\.com\//;


// ============================================================
// Utility
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// Keyboard
// ============================================================

async function keyTap(tabId, key) {

    await chrome.debugger.sendCommand(
        { tabId },
        "Input.dispatchKeyEvent",
        {
            type: "keyDown",
            key
        }
    );

    await chrome.debugger.sendCommand(
        { tabId },
        "Input.dispatchKeyEvent",
        {
            type: "keyUp",
            key
        }
    );
}


// ============================================================
// Scroll
// ============================================================

async function scrollUp(tabId, amount = 50) {

    await chrome.debugger.sendCommand(
        { tabId },
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


// ============================================================
// Get source
// ============================================================

async function getPageSource(tabId) {

    const result =
        await chrome.debugger.sendCommand(
            { tabId },
            "Runtime.evaluate",
            {
                expression: `
                    (() => {

                        const editor =
                            document.querySelector(
                                '[data-react-id="editor"]'
                            );

                        if (!editor) {
                            return {
                                found: false,
                                reason: "editor component not found"
                            };
                        }

                        const raw =
                            editor.getAttribute(
                                "data-react-data"
                            );

                        if (!raw) {
                            return {
                                found: false,
                                reason: "data-react-data not found"
                            };
                        }

                        try {

                            const data =
                                JSON.parse(raw);

                            const files =
                                data.default_files;

                            if (
                                !Array.isArray(files) ||
                                files.length === 0
                            ) {
                                return {
                                    found: false,
                                    reason: "default_files not found"
                                };
                            }

                            return {
                                found: true,
                                files
                            };

                        } catch (error) {

                            return {
                                found: false,
                                reason:
                                    "JSON parse failed: " +
                                    error.message
                            };
                        }
                    })()
                `,
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


    const value =
        result?.result?.value;


    if (!value?.found) {

        throw new Error(
            "Could not extract Exercism editor data: " +
            value?.reason
        );
    }


    const source =
        value.files
            .map(file => {

                return (
                    `// ${file.filename}\n` +
                    file.content
                );
            })
            .join("\n\n");


    console.log(
        "[workflow] Exercism source extracted:",
        value.files.length,
        "files,",
        source.length,
        "characters"
    );


    return source;
}


// ============================================================
// Find DeepSeek tab
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


// ============================================================
// Focus DeepSeek input
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
                            "textarea",
                            '[contenteditable="true"]',
                            '[role="textbox"]'
                        ];

                        for (const selector of selectors) {

                            const elements =
                                document.querySelectorAll(
                                    selector
                                );

                            for (const element of elements) {

                                if (
                                    element.offsetWidth > 0 &&
                                    element.offsetHeight > 0
                                ) {

                                    element.focus();

                                    return true;
                                }
                            }
                        }

                        return false;
                    })()
                `,
                returnByValue: true
            }
        );


    return result?.result?.value === true;
}


// ============================================================
// Wait for DeepSeek input
// ============================================================

async function waitForDeepSeekInput(
    tabId,
    timeout = 3000
) {

    const start =
        performance.now();


    while (
        performance.now() - start <
        timeout
    ) {

        const found =
            await focusDeepSeekInput(tabId);


        if (found) {

            return;
        }


        await sleep(100);
    }


    throw new Error(
        "DeepSeek input not found."
    );
}


// ============================================================
// Insert text
// ============================================================

async function insertText(
    tabId,
    text
) {

    await chrome.debugger.sendCommand(
        { tabId },
        "Input.insertText",
        {
            text
        }
    );
}


// ============================================================
// Main workflow
// ============================================================

async function runWorkflow() {

    const totalStart =
        performance.now();


    function mark(label, start) {

        console.log(
            `[profiler] ${label}:`,
            Math.round(performance.now() - start),
            "ms"
        );
    }


    // ========================================================
    // Current tab
    // ========================================================

    let start =
        performance.now();


    const tabs =
        await chrome.tabs.query({
            active: true,
            currentWindow: true
        });


    const currentTab =
        tabs[0];


    mark(
        "tabs.query",
        start
    );


    if (!currentTab?.id) {

        throw new Error(
            "Current tab not found."
        );
    }


    // ========================================================
    // Validate current page
    // ========================================================

    if (
        !EXERCISM_URL.test(currentTab.url) &&
        !LEETCODE_URL.test(currentTab.url)
    ) {

        throw new Error(
            "Current page is not a supported exercise page."
        );
    }


    // ========================================================
    // Attach to exercise page
    // ========================================================

    start =
        performance.now();


    await chrome.debugger.attach(
        { tabId: currentTab.id },
        "1.3"
    );


    mark(
        "Exercise debugger.attach",
        start
    );


    let source;


    try {

        // ====================================================
        // Get source
        // ====================================================

        start =
            performance.now();


        source =
            await getPageSource(
                currentTab.id,
                currentTab.url
            );


        mark(
            "getPageSource",
            start
        );


        console.log(
            "[workflow] page source:",
            source.length,
            "characters"
        );

    } finally {

        start =
            performance.now();


        await chrome.debugger.detach({
            tabId: currentTab.id
        });


        mark(
            "Exercise debugger.detach",
            start
        );
    }


    // ========================================================
    // Find DeepSeek
    // ========================================================

    start =
        performance.now();


    const deepSeekTab =
        await findDeepSeekTab();


    mark(
        "findDeepSeekTab",
        start
    );


    if (!deepSeekTab?.id) {

        throw new Error(
            "DeepSeek tab not found."
        );
    }


    // ========================================================
    // Activate DeepSeek
    // ========================================================

    start =
        performance.now();


    await chrome.tabs.update(
        deepSeekTab.id,
        {
            active: true
        }
    );


    mark(
        "activate DeepSeek",
        start
    );


    // ========================================================
    // Attach DeepSeek
    // ========================================================

    start =
        performance.now();


    await chrome.debugger.attach(
        { tabId: deepSeekTab.id },
        "1.3"
    );


    mark(
        "DeepSeek debugger.attach",
        start
    );


    try {

        // ====================================================
        // Find input
        // ====================================================

        start =
            performance.now();


        await waitForDeepSeekInput(
            deepSeekTab.id
        );


        mark(
            "waitForDeepSeekInput",
            start
        );


        // ====================================================
        // Insert source
        // ====================================================

        start =
            performance.now();


        await insertText(
            deepSeekTab.id,
            source
        );


        mark(
            `insertText (${source.length} chars)`,
            start
        );


        // ====================================================
        // Enter
        // ====================================================

        start =
            performance.now();


        await keyTap(
            deepSeekTab.id,
            "Enter"
        );


        mark(
            "Enter",
            start
        );


        // ====================================================
        // Scroll
        // ====================================================

        start =
            performance.now();


        await scrollUp(
            deepSeekTab.id,
            50
        );


        mark(
            "scroll",
            start
        );

    } finally {

        start =
            performance.now();


        await chrome.debugger.detach({
            tabId: deepSeekTab.id
        });


        mark(
            "DeepSeek debugger.detach",
            start
        );
    }


    console.log(
        "[profiler] TOTAL:",
        Math.round(
            performance.now() -
            totalStart
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
            command === "send_to_deepseek"
        ) {

            try {

                await runWorkflow();

            } catch (error) {

                console.error(
                    "[workflow] ERROR:",
                    error
                );

            }
        }
    }
);