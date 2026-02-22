
import { generatePdf } from './services/pdfGenerator.js';
import { initBrowser } from './utils/puppeteerPool.js';
import fs from 'fs';
import path from 'path';

async function testFragileHtml() {
    await initBrowser();

    // HTML with attributes on body, spaces, and no doctype
    const slideHtmls = [
        `<head><style>h1 { color: green; }</style></head> <body style="background: #eee;"> <h1>Fragile Slide 1</h1> </body>`,
        `<html><head><title>Test</title></head><body><h1>Fragile Slide 2</h1></body></html>`
    ];

    console.log('🧪 Testing PDF generation with "fragile" HTML...');
    try {
        const pdfBuffer = await generatePdf(slideHtmls, { w: 1280, h: 720 });
        const outputPath = path.join('output', 'fragile_test.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`✅ Fragile PDF generated successfully: ${outputPath} (${pdfBuffer.length} bytes)`);
    } catch (err) {
        console.error('❌ Fragile PDF generation failed:', err.message);
        process.exit(1);
    }

    process.exit(0);
}

testFragileHtml();
