# Exercism → DeepSeek

A small Chrome extension that sends the current **Exercism C exercise source** directly to an open **DeepSeek** tab.

It automates the repetitive workflow of:

```text
Exercism C exercise
        ↓
read current source
        ↓
switch to DeepSeek
        ↓
insert source
        ↓
send
```

The goal is simple: **reduce the friction between solving an Exercism exercise and asking DeepSeek about the code.**

## Features

* Detects the current Exercism C exercise editor page
* Reads the current page source using Chrome DevTools Protocol
* Finds an already-open DeepSeek tab
* Focuses the DeepSeek input box
* Inserts the Exercism source
* Sends it automatically
* Supports the extension button
* Supports `Ctrl+Shift+E`

## Requirements

* Google Chrome
* An Exercism account/session
* An open DeepSeek tab
* A DeepSeek account/session

Currently this extension is designed specifically for **Exercism C exercises**.

## Installation

This project is currently intended to be loaded as an unpacked Chrome extension.

1. Clone or download this repository.

```bash
git clone https://github.com/hawaka6667-dev/exercism-deepseek.git
```

2. Open:

```text
chrome://extensions/
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the repository directory.

The extension should now appear in your installed extensions.

## Usage

### 1. Open an Exercism C exercise

Open a C exercise in the Exercism editor, for example:

```text
https://exercism.org/tracks/c/exercises/<exercise>/edit
```

### 2. Open DeepSeek

Open:

```text
https://chat.deepseek.com/
```

and make sure you are logged in.

### 3. Run the workflow

Either:

* Click the **Exercism → DeepSeek** extension button, or
* Press:

```text
Ctrl+Shift+E
```

The extension will:

1. Verify that the active tab is an Exercism C exercise.
2. Read the current page source.
3. Find an open DeepSeek tab.
4. Switch to the DeepSeek tab.
5. Focus the input box.
6. Insert the source.
7. Press Enter.

## How it works

The extension uses **Chrome Manifest V3** and a background service worker.

The main workflow is implemented in `background.js`.

### Exercism

The extension checks for URLs matching:

```text
https://exercism.org/tracks/c/exercises/*/edit
```

It then temporarily attaches Chrome's debugger protocol to the tab and evaluates a `fetch()` using the current page's credentials to retrieve the page HTML.

### DeepSeek

The extension searches the currently open tabs for:

```text
https://chat.deepseek.com/
```

It then attaches the debugger protocol to that tab and uses DOM inspection to find a visible text input.

The source is inserted through:

```text
Input.insertText
```

and the message is submitted with:

```text
Input.dispatchKeyEvent
```

This avoids depending on a normal clipboard paste operation.

## Permissions

The extension currently requests:

```json
"permissions": [
  "tabs",
  "offscreen",
  "debugger"
]
```

and host access to:

```text
https://exercism.org/*
https://chat.deepseek.com/*
```

The `debugger` permission is required because the extension uses Chrome DevTools Protocol to read the Exercism page and interact with the DeepSeek page.

**Use this extension only if you are comfortable granting these permissions to locally loaded extension code.**

## Current limitations

This is an early project and intentionally has a narrow scope.

* Currently targets Exercism **C** exercises only.
* Requires an already-open DeepSeek tab.
* Requires the user to already be logged in to both services.
* Depends on the current structure of the Exercism and DeepSeek web interfaces.
* Changes to either website may break the workflow.
* The extension currently sends the retrieved page source directly rather than constructing a specialized prompt.
* There is currently no configuration UI.

## Why this exists

Copying code from an online exercise into an LLM is a small task, but it is repeated frequently during development.

This project treats that repetition as an automation opportunity.

Instead of:

```text
select
→ copy
→ switch tab
→ click input
→ paste
→ press Enter
```

the intended workflow is:

```text
Ctrl+Shift+E
```

That's it.

## Project status

**Early / experimental.**

The project is primarily a small personal engineering experiment around browser automation, Chrome extensions, and integrating existing web applications without requiring their APIs.

Expect breaking changes while the implementation evolves.

## Contributing

Issues and pull requests are welcome.

If you find that a website change breaks the workflow, please include:

* Browser version
* Extension version
* Which step failed
* Relevant console output

## License

No license has been specified yet.
