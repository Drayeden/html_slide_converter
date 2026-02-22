import { getPage } from '../utils/puppeteerPool.js';

/**
 * Capture a single slide as a high-resolution PNG screenshot.
 * Supports dynamic slide sizes and complete HTML documents.
 *
 * @param {string} slideHtml - Complete HTML for one slide
 * @param {object} options - { width, height }
 * @returns {Buffer} PNG image buffer
 */
export async function captureSlide(slideHtml, options = {}) {
  const { width = 1280, height = 720 } = options;
  const page = await getPage();

  try {
    // Use 2x device pixel ratio for sharper screenshots in PPT
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    // Check if input is already a complete HTML document
    const isComplete = slideHtml.trim().toLowerCase().startsWith('<!doctype') ||
      slideHtml.trim().toLowerCase().startsWith('<html');

    let fullHtml;
    if (isComplete) {
      fullHtml = slideHtml;
    } else {
      fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        ${slideHtml}
      </body>
      </html>
      `;
    }

    console.log(`    [captureSlide] Setting content (${fullHtml.length} bytes, complete=${isComplete})...`);
    await page.setContent(fullHtml, {
      waitUntil: 'load',
      timeout: 60000, // Increase timeout to 60s
    });


    // Wait for fonts, images, and external resources to load
    console.log(`    [captureSlide] Waiting for fonts...`);
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`    [captureSlide] Taking screenshot...`);
    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    });

    return screenshot;
  } finally {
    await page.close();
  }
}

/**
 * Capture multiple slides in sequence.
 * @param {string[]} slideHtmls - Array of slide HTML strings
 * @param {function} onProgress - Progress callback (current, total)
 * @param {object} slideSize - { w, h } slide dimensions
 * @returns {Buffer[]} Array of PNG buffers
 */
export async function captureSlides(slideHtmls, onProgress = null, slideSize = { w: 1280, h: 720 }) {
  const results = [];

  for (let i = 0; i < slideHtmls.length; i++) {
    const screenshot = await captureSlide(slideHtmls[i], {
      width: slideSize.w,
      height: slideSize.h,
    });
    results.push(screenshot);

    if (onProgress) {
      onProgress(i + 1, slideHtmls.length);
    }
  }

  return results;
}
