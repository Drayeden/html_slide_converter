import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export function getOutputDir() {
    return OUTPUT_DIR;
}

export function generateFilename() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}${mo}${d}_${h}${mi}${s}`;
}

export function getVerifiedFilename(filename) {
    // "20260217_171200" → "20260217_171200(verified)"
    return `${filename}(verified)`;
}

export function getOutputPath(filename, ext) {
    return path.join(OUTPUT_DIR, `${filename}.${ext}`);
}
