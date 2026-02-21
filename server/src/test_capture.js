import { captureSlide } from './services/slideCapture.js';
import { initBrowser } from './utils/puppeteerPool.js';
import fs from 'fs';

const slideHtml = fs.readFileSync('../sample_slide.html', 'utf-8');

async function test() {
    console.log('Initializing browser...');
    await initBrowser();

    console.log('Capturing slide...');
    console.log('HTML length:', slideHtml.length);
    console.log('Starts with DOCTYPE:', slideHtml.trim().toLowerCase().startsWith('<!doctype'));

    try {
        const screenshot = await captureSlide(slideHtml, { width: 1280, height: 720 });
        console.log('Screenshot size:', screenshot.length, 'bytes');
        fs.writeFileSync('../test_output.png', screenshot);
        console.log('Saved to test_output.png');
    } catch (err) {
        console.error('CAPTURE ERROR:', err.message);
        console.error('STACK:', err.stack);
    }

    process.exit(0);
}

test();
