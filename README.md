# Coding Site2LLM

A Chrome extension that captures coding-site context from Exercism, LeetCode, and similar platforms and sends it directly to your LLM (DeepSeek, ChatGPT, Claude, Gemini, etc.) with one click.

## Features

- 🎯 One-click send: `Ctrl+Shift+E` or click the extension button
- 🌐 Support for Exercism and LeetCode, with extensibility for more sites
- 🤖 Works with DeepSeek, ChatGPT, Claude, Gemini, and DeepAI
- ⚡ Captures coding context and inserts it into the active LLM tab

## Install

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Use

1. Open an exercise on Exercism or a coding problem on LeetCode.
2. Keep a supported LLM website open in another tab.
3. Click the extension button or press `Ctrl+Shift+E` to send the coding problem to your LLM.

## Notes

- Use the normal Exercism URL, not a `view-source:` URL.
- This project currently focuses on Exercism C exercises and LeetCode problems.
- The extension searches nearby tabs for DeepSeek, ChatGPT, Claude, Gemini, or DeepAI. If none is open, it creates a DeepSeek tab to the left of the current tab.
- Only content captured from the website is sent; the extension does not add labels, instructions, or Markdown formatting.

For development notes and tests, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Requirements

- Chrome browser
- Active session on both the coding platform and LLM service
- LLM tab must be open

## License

MIT License
