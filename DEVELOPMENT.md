# Development Notes

## Architecture

`background.js` is the Manifest V3 service worker. It reads the active
Exercism or LeetCode editor through Chrome DevTools Protocol, finds an open
DeepSeek tab, inserts the source, and submits it.

Exercism extraction first tries embedded exercise data, then falls back to
rendered CodeMirror, textarea, or contenteditable editors. `view-source:` pages
are rejected because Chrome does not allow debugger attachment to them.

The extension requires `tabs` and `debugger` permissions, plus host access for
Exercism, LeetCode, and DeepSeek.

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
