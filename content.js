/*
 * Exercism page integration: Ctrl+Enter starts the site's test -> submit
 * workflow through the service worker. Chrome commands cannot bind Enter.
 */

document.addEventListener("keydown", event => {
    if (
        event.key !== "Enter" ||
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey
    ) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "exercism-test-submit" });
});