
import { processSlides } from './services/slideSplitter.js';

function testSplitterTypes() {
    console.log('🧪 Testing Slide Splitter with different input types...');

    const testCases = [
        { name: 'null', input: null },
        { name: 'undefined', input: undefined },
        { name: 'object', input: { some: 'data' } },
        { name: 'array', input: ['<div class="slide">1</div>'] },
        { name: 'empty string', input: '' }
    ];

    let allPassed = true;
    for (const { name, input } of testCases) {
        try {
            console.log(`  - Testing with ${name}...`);
            const result = processSlides(Array.isArray(input) ? input : [input]);
            console.log(`    ✅ Success: Found ${result.slides.length} slides`);
        } catch (err) {
            console.error(`    ❌ Failed on ${name}:`, err.message);
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('\n✅ ALL SPLITTER TYPE TESTS PASSED');
    } else {
        console.error('\n❌ SOME SPLITTER TYPE TESTS FAILED');
        process.exit(1);
    }
}

testSplitterTypes();
