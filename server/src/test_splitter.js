import { processSlides } from './services/slideSplitter.js';
import fs from 'fs';

const html = fs.readFileSync('../test_multi_slide.html', 'utf-8');
console.log('Input HTML length:', html.length);

try {
    const result = processSlides([html]);
    console.log('Slides found:', result.slides.length);
    console.log('Slide size:', result.slideSize);
    result.slides.forEach((s, i) => {
        console.log(`  Slide ${i + 1}: ${s.length} bytes, has .slide:`, s.includes('class="slide"'));
    });
    console.log('✅ splitSlides works');
} catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error(e.stack);
}
