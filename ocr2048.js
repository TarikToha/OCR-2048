/**
 * Performs OCR on a 2048 game screenshot.
 * @param {string} imageSrc - The image source URL or path.
 * @param {function} debug - Optional debug logging function.
 * @returns {Promise<number[][]>} - A 4×4 array of recognized tile values.
 */
export async function ocr2048(imageSrc, debug = console.log) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = async () => {
            const start = performance.now(); // ⏱️ Start timing

            try {
                // Draw image onto a canvas
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Load image into OpenCV matrix
                const mat = cv.imread(canvas);

                // Detect the 2048 board region
                const boardRect = detectBoard(mat);
                if (!boardRect) {
                    reject("❌ Could not detect board.");
                    return;
                }

                debug(`✅ Board found at [${boardRect.x}, ${boardRect.y}, ${boardRect.width}, ${boardRect.height}]`);

                // Crop the board region
                const board = mat.roi(boardRect).clone();
                mat.delete();

                // Split board into 16 tiles
                const tiles = cropTiles(board);
                board.delete();

                // Initialize 16 Tesseract workers
                const NUM_WORKERS = 16;
                const workers = await Promise.all(
                    Array.from({length: NUM_WORKERS}, async () => {
                        const worker = await Tesseract.createWorker();
                        await worker.load();
                        await worker.loadLanguage("eng");
                        await worker.initialize("eng");
                        return worker;
                    })
                );

                // OCR each tile
                const ocrTasks = tiles.map((tile, i) => {
                    const canvasTile = toCanvas(tile);
                    tile.delete();
                    const worker = workers[i % NUM_WORKERS];
                    return ocrTile(canvasTile, worker).then(val => {
                        debug(`Tile ${i + 1}: ${val}`);
                        return val;
                    });
                });

                const values = await Promise.all(ocrTasks);
                await Promise.all(workers.map(w => w.terminate()));

                const duration = (performance.now() - start).toFixed(1);
                debug(`⏱️ OCR completed in ${duration} ms`);

                resolve(chunk(values, 4));
            } catch (err) {
                reject("❌ Error: " + err);
            }
        };

        img.onerror = () => reject("❌ Could not load image.");
        img.src = imageSrc;
    });
}

/**
 * Detects the square board region using contours and filtering.
 */
function detectBoard(src) {
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    let edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let candidates = [];
    for (let i = 0; i < contours.size(); i++) {
        let rect = cv.boundingRect(contours.get(i));
        const aspect = rect.width / rect.height;
        if (aspect > 0.85 && aspect < 1.15 && rect.width * rect.height > 30000) {
            candidates.push(rect);
        }
    }

    // Clean up
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    // Return the largest square-ish contour
    return candidates.length ? candidates.reduce((a, b) =>
        (a.width * a.height > b.width * b.height ? a : b)) : null;
}

/**
 * Splits the cropped board into 16 equal-sized OpenCV tiles.
 */
function cropTiles(board) {
    const tiles = [];
    const size = board.cols / 4;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const rect = new cv.Rect(c * size, r * size, size, size);
            tiles.push(board.roi(rect).clone());
        }
    }
    return tiles;
}

/**
 * Converts an OpenCV mat to HTML canvas.
 */
function toCanvas(mat) {
    const c = document.createElement("canvas");
    c.width = mat.cols;
    c.height = mat.rows;
    cv.imshow(c, mat);
    return c;
}

/**
 * Applies OCR to a single canvas tile using a given Tesseract worker.
 */
async function ocrTile(canvas, worker) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const margin = 0.15;

    // Crop margins
    const cropX = w * margin;
    const cropY = h * margin;
    const cropW = w * (1 - 2 * margin);
    const cropH = h * (1 - 2 * margin);

    const data = ctx.getImageData(cropX, cropY, cropW, cropH);
    const temp = document.createElement("canvas");
    temp.width = cropW;
    temp.height = cropH;
    temp.getContext("2d").putImageData(data, 0, 0);

    // OCR with digit whitelist
    const {data: {text}} = await worker.recognize(temp, "eng", {
        tessedit_char_whitelist: "0123456789",
        psm: 10
    });

    const cleaned = text.trim();
    const val = /^\d+$/.test(cleaned) ? parseInt(cleaned) : 0;
    return [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].includes(val) ? val : 0;
}

/**
 * Converts a flat array into a 2D 4×4 grid.
 */
function chunk(arr, size) {
    return Array.from({length: size}, (_, i) => arr.slice(i * size, i * size + size));
}