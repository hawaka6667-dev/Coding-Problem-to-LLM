
## Install

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Use

1. Open a exercise on Exercism:

   `https://exercism.org/tracks/c/exercises/<exercise>/edit`

2. Keep a supported LLM website open in another tab.
3. Click the extension button or press `Ctrl+Shift+E` to send
   coding problem to the LLM.


## Notes

- Use the normal Exercism URL, not a `view-source:` URL.
- This project currently focuses on Exercism C exercises and LeetCode problems.
- The extension searches nearby tabs for DeepSeek, ChatGPT, Claude, Gemini, or
   DeepAI. If none is open, it creates a DeepSeek tab to the left of the current
   tab.
- Only content captured from the website is sent; the extension does not add
   labels, instructions, or Markdown formatting.

For development notes and tests, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

No license has been specified yet.
