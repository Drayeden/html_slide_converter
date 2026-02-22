
import { generatePdf } from './services/pdfGenerator.js';
import { initBrowser } from './utils/puppeteerPool.js';
import fs from 'fs';
import path from 'path';

async function reproduce() {
    await initBrowser();

    // Sample minimalist slide HTML that might cause issues if head extraction fails
    const slideHtmls = [
        `<!DOCTYPE html><html><head><style>.test { color: red; }</style></head><body><div class="test">Slide 1</div></body></html>`,
        `<!DOCTYPE html><html><head><style>.test { color: blue; }</style></head><body><div class="test">Slide 2</div></body></html>`
    ];

    console.log('🧪 Testing PDF generation with sample slides...');
    try {
        const pdfBuffer = await generatePdf(slideHtmls, { w: 1280, h: 720 });
        const outputPath = path.join('output', 'repro_test.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`✅ PDF generated successfully: ${outputPath} (${pdfBuffer.length} bytes)`);

        if (pdfBuffer.length < 2000) {
            console.error('❌ PDF seems too small/empty. It might be blank.');
        }
    } catch (err) {
        console.error('❌ PDF generation failed:', err);
    }

    process.exit(0);
}

reproduce();
