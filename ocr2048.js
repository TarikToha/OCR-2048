export async function ocr2048(imageSrc, debug = console.log) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const mat = cv.imread(canvas);
                const boardRect = detectBoard(mat);
                if (!boardRect) {
                    reject("❌ Could not detect board.");
                    return;
                }

                debug(`✅ Board found at [${boardRect.x}, ${boardRect.y}, ${boardRect.width}, ${boardRect.height}]`);
                const board = mat.roi(boardRect);
                const tiles = cropTiles(board);

                const values = [];
                for (let i = 0; i < tiles.length; i++) {
                    const tileCanvas = toCanvas(tiles[i]);
                    const val = await ocrTile(tileCanvas);
                    debug(`Tile ${i + 1}: ${val}`);
                    values.push(val);
                }

                mat.delete();
                board.delete();
                tiles.forEach(t => t.delete());
                resolve(chunk(values, 4));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject("❌ Could not load image.");
        img.src = imageSrc;
    });
}

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

    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    return candidates.length ? candidates.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b)) : null;
}

function cropTiles(board) {
    const tiles = [];
    const size = board.cols / 4;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const rect = new cv.Rect(c * size, r * size, size, size);
            tiles.push(board.roi(rect));
        }
    }
    return tiles;
}

function toCanvas(mat) {
    const c = document.createElement("canvas");
    c.width = mat.cols;
    c.height = mat.rows;
    cv.imshow(c, mat);
    return c;
}

async function ocrTile(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const margin = 0.15;

    const cropX = w * margin;
    const cropY = h * margin;
    const cropW = w * (1 - 2 * margin);
    const cropH = h * (1 - 2 * margin);

    const data = ctx.getImageData(cropX, cropY, cropW, cropH);
    const temp = document.createElement("canvas");
    temp.width = cropW;
    temp.height = cropH;
    temp.getContext("2d").putImageData(data, 0, 0);

    const {data: {text}} = await Tesseract.recognize(temp, "eng", {
        tessedit_char_whitelist: "0123456789",
        psm: 6
    });

    const cleaned = text.trim();
    const val = /^\d+$/.test(cleaned) ? parseInt(cleaned) : 0;
    return [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].includes(val) ? val : 0;
}

function chunk(arr, size) {
    return Array.from({length: 4}, (_, i) => arr.slice(i * 4, i * 4 + 4));
}
