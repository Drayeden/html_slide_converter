/**
 * End-to-end test: splitSlides → captureSlide → verify
 */
import { processSlides } from './services/slideSplitter.js';
import { captureSlides } from './services/slideCapture.js';
import fs from 'fs';

const html = fs.readFileSync('../test_multi_slide.html', 'utf-8');

async function test() {
    console.log('=== Step 1: Split slides ===');
    const { slides, slideSize } = processSlides([html]);
    console.log(`Found ${slides.length} slides, size: ${slideSize.w}×${slideSize.h}`);

    // Save first split slide for inspection
    fs.writeFileSync('test_split_slide_1.html', slides[0]);
    console.log('Saved split slide 1 to test_split_slide_1.html');

    console.log('\n=== Step 2: Capture screenshots ===');
    try {
        const screenshots = await captureSlides(slides, (cur, total) => {
            console.log(`  📷 Captured ${cur}/${total}`);
        }, slideSize);
        console.log(`Captured ${screenshots.length} screenshots`);
        screenshots.forEach((s, i) => {
            console.log(`  Screenshot ${i + 1}: ${s.length} bytes`);
        });
        console.log('\n✅ ALL STEPS PASSED');
    } catch (e) {
        console.error('\n❌ Capture failed:', e.message);
        console.error(e.stack);
    }

    process.exit(0);
}

test();
