# Development Notes

This document describes the project structure, website responsibilities, and
the manual development and testing workflow.

## Architecture

`background.js` is the Manifest V3 service-worker entry point. It loads the
worker files in dependency order with `importScripts`:

- `worker/config.js`: URL patterns, LLM providers, and input selectors.
- `worker/page-utils.js`: page injection, keyboard events, scrolling, and
	timing helpers.
- `worker/adapters.js`: Exercism and LeetCode page adapters.
- `worker/routing.js`: platform selection and captured-content assembly.
- `worker/llm.js`: LLM tab selection and input operations.
- `worker/workflow.js`: the main workflow and Chrome event listeners.

The service worker reads the active Exercism or LeetCode context with
`chrome.scripting.executeScript`, finds a nearby LLM tab, assembles the
captured page content, inserts it, and submits it.

Exercism extraction first tries embedded exercise data, then falls back to
rendered CodeMirror, textarea, or contenteditable editors. `view-source:` pages
are rejected because they are not supported extension page targets.

The extension requires `tabs` and `scripting` permissions, plus host access for
Exercism, LeetCode, and the supported LLM websites.

### Extension responsibility

The extension is a transport layer. It captures content already present on the
coding website, removes unrelated page-generated sections when required, and
passes the remaining title, problem text, source code, and visible feedback to
the LLM.

## Website design requirements

Website-specific behavior belongs in the corresponding adapter or content
script. The general workflow should not contain selectors for a particular
website.

Functions passed to `chrome.scripting.executeScript` run in the target page,
not in the service worker. They must be self-contained and must not reference
helpers from another worker file. This boundary is especially important for
the Exercism `Ctrl+Enter` button automation.

### Main workflow

`Ctrl+Shift+E` is the Manifest `commands` shortcut. It starts the main
workflow: capture the current supported coding page, find an LLM tab, insert
the captured content, and send it.

### Exercism

This automation is custom extension logic, not a native Exercism feature. The
site does not provide a dedicated API or supported shortcut for this flow, so
we implement the interaction by detecting the visible buttons and clicking them
in sequence.

- First, check whether the page is already in the commit-ready state.
- Otherwise, click the visible `Run Tests` action.
- When the slow automated feedback screen appears, click `Continue without
	waiting` instead of blocking on the feedback request.
- Click `Submit` after continuing.

This flow is implemented in `content.js` and the Exercism adapter in
`worker/adapters.js`. Chrome does not accept `Ctrl+Enter` as a Manifest
`commands` shortcut, so the page content script owns this key binding.

### LLM tab selection

- Do not hard-code the workflow to DeepSeek.
- Search the current window's tabs from the current coding page toward the
	left, then wrap from the right side back toward the current tab.
- Recognize common providers such as DeepSeek, ChatGPT, Claude, Gemini, and
	DeepAI.
- If no supported LLM tab exists, create a DeepSeek tab immediately to the
	left of the coding page.

### Context and feedback

- Send only content captured from the website. Do not add labels, instructions,
	or Markdown fences in `buildPrompt`.
- LeetCode context may include the title, visible description, editor source,
	and the latest visible result such as `Wrong Answer`, expected output, or
	actual output.
- Do not use LeetCode SEO/meta descriptions as a substitute for visible
	problem content. Exclude `Editorial`, `Questions you should ask yourself`,
	and performance-ranking text such as `Beats 99%`.
- If no result is visible, omit the feedback content entirely.

The initial context flow is implemented. More robust submission-result
selectors and continuous feedback updates remain website-specific follow-up
work.

On Exercism, `Ctrl+Enter` clicks the visible `Run Tests` action, clicks
`Continue without waiting` when the automated feedback screen appears, and
then clicks `Submit`. It does not wait for the slow automated feedback.

## Tests

Run the local tests from this directory:

```bash
node --test unit-routing.test.js
```

The browser smoke test needs Chrome started with remote debugging enabled:

```bash
node browser-smoke.test.js
node browser-smoke.test.js --port 9223 --json
```

The smoke test only inspects supported pages. It does not send messages.

## Development workflow

After changing extension files:

1. Run `npm test`.
2. Run `node --check background.js` when the service worker changes.
3. Open `chrome://extensions/` and click **Reload** for this unpacked
   extension.
4. Test the changed website behavior manually.

The browser smoke test is optional and requires Chrome remote debugging:

```bash
npm run smoke
```
