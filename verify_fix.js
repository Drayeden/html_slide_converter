import { splitSlides, processSlides } from './server/src/services/slideSplitter.js';
import { captureSlides } from './server/src/services/slideCapture.js';
import fs from 'fs';

async function test() {
    console.log('🧪 Testing slide splitting...');
    const sampleHtml = `
        <div class="slide">Slide 1</div>
        <div class="slide">Slide 2</div>
    `;

    try {
        const result = splitSlides(sampleHtml);
        console.log(`✅ splitSlides: Found ${result.slides.length} slides`);

        if (result.slides.length !== 2) {
            throw new Error(`Expected 2 slides, found ${result.slides.length}`);
        }

        console.log('🧪 Testing processSlides with non-string input...');
        const result2 = processSlides([sampleHtml, null, undefined, { nested: 'html' }]);
        console.log(`✅ processSlides: Handled mixed inputs, found ${result2.slides.length} slides`);

        console.log('✅ Unit test passed locally!');
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

test();
