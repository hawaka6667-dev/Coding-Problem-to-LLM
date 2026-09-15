# Exercism -> DeepSeek

A Chrome extension that sends the current Exercism C exercise source to an
open DeepSeek chat.

## Requirements

- Google Chrome
- An Exercism account
- An open, signed-in DeepSeek tab

## Install

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Use

1. Open a C exercise on Exercism:

   `https://exercism.org/tracks/c/exercises/<exercise>/edit`

2. Keep DeepSeek open in another tab.
3. Click the extension button or press `Ctrl+Shift+E`.

The extension reads the exercise source, switches to DeepSeek, inserts it, and
sends the message.

## Notes

- Use the normal Exercism URL, not a `view-source:` URL.
- This project currently focuses on Exercism C exercises.

For development notes and tests, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

No license has been specified yet.
