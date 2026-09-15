# Coding-Problem-to-LLM

A Chrome extension that automates sending code from coding challenge platforms (Exercism, LeetCode, etc.) directly to your preferred LLM (DeepSeek, ChatGPT, Claude, etc.).

It automates the repetitive workflow of:

```text
Coding Challenge Platform
         ↓
read current source
         ↓
switch to LLM tab
         ↓
insert source
         ↓
send
```

The goal is simple: **reduce the friction between solving a coding challenge and asking an LLM about the code.**

## Features

* Detects current coding exercise editor pages from supported platforms
* Reads the current page source using Chrome DevTools Protocol
* Finds an already-open LLM chat tab
* Focuses the LLM input box
* Inserts the source code
* Sends it automatically
* Supports the extension button click
* Supports `Ctrl+Shift+E` keyboard shortcut
* Modular platform adapter architecture for easy extensibility
* Comprehensive test coverage (unit tests and smoke tests)

## Supported Platforms

### Coding Challenge Sites
* **Exercism** (all programming tracks)
* **LeetCode** (problems and challenges)
* **More coming soon** (CodeWars, HackerRank, etc.)

### LLM Services
* **DeepSeek** (current support)
* **ChatGPT** (planned)
* **Claude** (planned)
* **More coming soon**

## Requirements

* Google Chrome browser
* Account/active session on a supported coding platform
* An open LLM chat tab in Chrome
* Account/active session on the LLM service

## Installation

Currently this extension is intended to be loaded as an unpacked Chrome extension.

1. Clone or download this repository:

```bash
git clone https://github.com/hawaka6667-dev/Coding-Problem-to-LLM.git
```

2. Open Chrome Extensions page:

```text
chrome://extensions/
```

3. Enable **Developer mode** (toggle in top right corner).

4. Click **Load unpacked**.

5. Select the repository directory.

The extension should now appear in your installed extensions.

## Usage

### 1. Open a coding challenge

Open a supported coding challenge in your browser:

```text
https://exercism.org/tracks/<language>/exercises/<exercise>/edit
or
https://leetcode.com/problems/<problem>/
```

### 2. Open your LLM chat service

Open your preferred LLM in another tab:

```text
https://chat.deepseek.com/
```

Make sure you are logged in.

### 3. Trigger the workflow

Choose one of the following methods:

* **Method 1:** Click the **Coding-Problem-to-LLM** extension button in your toolbar, or
* **Method 2:** Press the keyboard shortcut:

```text
Ctrl+Shift+E
```

The extension will automatically:

1. Verify that the active tab is a supported coding challenge
2. Extract the source code from the page
3. Find an open LLM chat tab
4. Switch to the LLM tab
5. Focus the chat input box
6. Insert the source code
7. Submit the message

Done! Your code is now in the LLM for discussion.

## How it works

The extension uses **Chrome Manifest V3** with a background service worker for better security and performance.

### Architecture

The main workflow logic is in `background.js` with modular platform adapters:

1. **Platform Adapters** - Separate adapters for Exercism and LeetCode to extract code
2. **Tab Detection** - Checks if current tab is a supported coding platform
3. **Code Extraction** - Uses Chrome DevTools Protocol to read page DOM and extract source
4. **LLM Tab Search** - Queries all open tabs to find a supported LLM chat
5. **Code Insertion** - Uses DevTools Protocol to insert text into LLM chat input
6. **Message Submission** - Simulates keyboard input to send the message

### Technical Details

**For Coding Platforms:**
- Temporarily attaches Chrome debugger to read page content
- Uses platform-specific selectors to locate and extract code
- Supports multiple programming languages and file formats

**For LLM Services:**
- Searches for visible input fields (textarea, contenteditable, etc.)
- Inserts code using `Input.insertText` command
- Submits with keyboard event simulation (avoids clipboard dependency)

## Testing

The project includes automated tests:

```bash
# Run unit tests
npm test -- --testMatch="**/*.test.js"

# Run smoke tests (requires Chrome debugger protocol)
npm test -- browser-smoke.test.js
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development notes.

## Permissions

The extension requests the following permissions:

```json
"permissions": [
  "tabs",
  "debugger"
]
```

And requires host access to supported platforms:
- `https://exercism.org/*`
- `https://leetcode.com/*`
- `https://chat.deepseek.com/*`

**Why these permissions?**
- `tabs` - Needed to query and switch between open tabs
- `debugger` - Required for Chrome DevTools Protocol to read/interact with pages

**Security Note:** Only use this extension if you're comfortable granting debugger access to locally loaded extension code. The extension only operates on specified domains listed in host_permissions.

## Current Limitations

This is an early-stage project with growing scope:

* Platform and LLM support is currently limited (see "Supported Platforms" above)
* Requires an already-open LLM chat tab
* Requires being logged into both the coding platform and LLM service
* Depends on current website HTML/DOM structure - website updates may break functionality
* Currently sends raw source code without custom prompt engineering
* No configuration UI yet (all settings hardcoded)
* Single-language support (English)

## Why this project exists

Copying code from an online coding challenge into an LLM is a small, repetitive task that happens constantly during coding practice and interview preparation.

This project automates that friction point.

**Before (7 clicks):**
```text
select code
→ copy
→ switch to LLM tab
→ click input
→ paste
→ add context text
→ press Enter
```

**After (1 action):**
```text
Ctrl+Shift+E
```

## Roadmap

- [ ] Support for ChatGPT
- [ ] Support for Claude
- [ ] Support for Gemini
- [ ] Support for more coding platforms (CodeWars, HackerRank, LeetCode Premium, etc.)
- [ ] Configuration UI (select active platforms and LLMs)
- [ ] Custom prompt templates
- [ ] Code language detection
- [ ] Multi-file support
- [ ] Dark mode support

## Project Status

**Early / Experimental**

This project is a personal engineering experiment around:
- Browser automation and Chrome extensions
- Chrome DevTools Protocol usage
- Integration with existing web applications without APIs
- Reducing developer friction in learning workflows

Expect breaking changes and rapid iterations while the implementation evolves.

## Contributing

Issues and pull requests are welcome!

### Reporting Bugs

If you find something broken, please include:
- Browser version (chrome://version/)
- Extension version (from chrome://extensions/)
- Which coding platform you were using
- Which LLM you were using
- Which step failed
- Console output (press F12, check Console tab)
- Screenshots if applicable

### Adding Support for New Platforms

We're actively looking to support more coding challenge platforms! PRs are welcome.

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Author

Created by [hawaka6667-dev](https://github.com/hawaka6667-dev)

## Support

If you run into issues or have feature requests, please [open an issue](https://github.com/hawaka6667-dev/Coding-Problem-to-LLM/issues).
