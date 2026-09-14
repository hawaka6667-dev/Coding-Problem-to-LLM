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

    // --------------------------------------------------------
    // 1. Current Exercism tab
    // --------------------------------------------------------

    const [currentTab] =
        await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        });


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
            "Current page is not an Exercism C exercise /edit page."
        );
    }


    console.log(
        "[workflow] Exercism detected"
    );


    // --------------------------------------------------------
    // 2. Attach Exercism
    // --------------------------------------------------------

    await chrome.debugger.attach(
        { tabId: currentTab.id },
        "1.3"
    );


    console.log(
        "[workflow] debugger attached to Exercism"
    );


    let source;


    try {

        // ----------------------------------------------------
        // 3. Get HTML
        // ----------------------------------------------------

        source =
            await getPageSource(
                currentTab.id
            );


        console.log(
            "[workflow] page source:",
            source.length,
            "characters"
        );

    } finally {

        try {

            await chrome.debugger.detach({
                tabId: currentTab.id
            });

        } catch (_) {}
    }


    // --------------------------------------------------------
    // 4. Find DeepSeek
    // --------------------------------------------------------

    const deepseek =
        await findDeepSeekTab();


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

    await chrome.tabs.update(
        deepseek.id,
        {
            active: true
        }
    );


    // --------------------------------------------------------
    // 6. Attach debugger
    // --------------------------------------------------------

    await chrome.debugger.attach(
        { tabId: deepseek.id },
        "1.3"
    );


    console.log(
        "[workflow] debugger attached to DeepSeek"
    );


    try {

        // ----------------------------------------------------
        // 7. Wait for input
        // ----------------------------------------------------

        await waitForDeepSeekInput(
            deepseek.id
        );


        // ----------------------------------------------------
        // 8. Insert source
        // ----------------------------------------------------

        await insertText(
            deepseek.id,
            source
        );


        // ----------------------------------------------------
        // 9. Enter
        // ----------------------------------------------------

        await keyTap(
            deepseek.id,
            "Enter",
            "Enter"
        );


        console.log(
            "[workflow] enter sent"
        );


        // ----------------------------------------------------
        // 10. Scroll up slightly
        // ----------------------------------------------------

        await scrollUp(
            deepseek.id,
            70
        );

    } finally {

        try {

            await chrome.debugger.detach({
                tabId: deepseek.id
            });

        } catch (_) {}
    }


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