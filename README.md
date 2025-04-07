# 2048 OCR Web App

## Overview

A browser-based OCR demo that detects the game board state from a screenshot of the 2048 game using Tesseract.js and OpenCV.js. Users can upload a screenshot, and the app will display a recognized 4×4 grid of tile values.

## Features

- Upload and preview a screenshot of the 2048 game.
- Automatically segments and analyzes the board using OpenCV.js.
- Recognizes tile numbers using Tesseract.js OCR.
- Displays the 4×4 board in a clean monospace format.
- Real-time logging of debug messages for troubleshooting.

## Technologies

- HTML, CSS, JavaScript (ES Modules)
- [Tesseract.js](https://github.com/naptha/tesseract.js) – OCR engine in JavaScript.
- [OpenCV.js](https://docs.opencv.org/) – image processing in the browser.

## File Structure

- `index.html` – Main UI and logic.
- `ocr2048.js` – Module that handles image segmentation and OCR.
- `opencv.js` – WebAssembly build of OpenCV.
- `tesseract.min.js` – Minified version of Tesseract.js.

## How to Use

1. Open the app in a browser (served locally or hosted).
2. Upload a screenshot of a 2048 game board.
3. View the extracted tile values and debug log.

## Example Input

![2048 Game Screenshot](screencaps/screenshot265.png)

## Example Output

```text
🧩 OCR 2048 Board:
   2   4   4   8
  32  16   4   2
   2  64  16   4
  32   8   4   2
```

## Notes

- Accuracy depends on image clarity and tile font consistency.
- Works entirely in-browser—no backend required.
