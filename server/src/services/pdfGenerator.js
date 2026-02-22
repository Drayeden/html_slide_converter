import { getPage } from '../utils/puppeteerPool.js';

/**
 * Generate a PDF from slides HTML using Puppeteer.
 * Each slide becomes one PDF page. Supports dynamic slide sizes.
 *
 * @param {string[]} slideHtmls - Array of slide HTML strings
 * @param {object} slideSize - { w, h } slide dimensions
 * @returns {Buffer} PDF file buffer
 */
export async function generatePdf(slideHtmls, slideSize = { w: 1280, h: 720 }) {
  const page = await getPage();
  const { w, h } = slideSize;

  try {
    // Check if slides are complete HTML documents
    const isComplete = slideHtmls[0]?.trim().toLowerCase().startsWith('<!doctype') ||
      slideHtmls[0]?.trim().toLowerCase().startsWith('<html');

    let fullHtml;

    if (isComplete) {
      // For complete HTML slides, render each one individually and combine
      const slidesHtml = slideHtmls.map((html, i) => {
        // Robust extraction of body content
        const bodyContent = html.replace(/[\s\S]*<body[^>]*>([\s\S]*?)<\/body>[\s\S]*/i, '$1');

        return `
        <div class="pdf-slide" style="
          width: ${w}px;
          height: ${h}px;
          overflow: hidden;
          page-break-after: always;
          position: relative;
        ">
          ${bodyContent}
        </div>`;
      }).join('\n');

      // Robust extraction of head content from first slide
      const sharedHead = slideHtmls[0].replace(/[\s\S]*<head[^>]*>([\s\S]*?)<\/head>[\s\S]*/i, '$1');

      fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${sharedHead}
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: ${w}px ${h}px;
            margin: 0;
          }
          html, body {
            width: ${w}px;
            margin: 0;
            padding: 0;
          }
          .pdf-slide:last-child {
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        ${slidesHtml}
      </body>
      </html>
      `;
    } else {
      // For partial HTML slides
      const slidesHtml = slideHtmls.map((html, i) => `
        <div class="pdf-slide" style="
          width: ${w}px;
          height: ${h}px;
          overflow: hidden;
          page-break-after: always;
          position: relative;
        ">
          ${html}
        </div>
      `).join('\n');

      fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: ${w}px ${h}px;
            margin: 0;
          }
          html, body {
            width: ${w}px;
            margin: 0;
            padding: 0;
          }
          .pdf-slide:last-child {
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        ${slidesHtml}
      </body>
      </html>
      `;
    }

    await page.setViewport({ width: w, height: h });
    await page.setContent(fullHtml, {
      waitUntil: ['networkidle0', 'domcontentloaded'], // Improved wait strategy
      timeout: 60000,
    });

    // Ensure fonts and specific dynamic content are ready
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });

    // Additional stabilization delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const pdfBuffer = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    if (!pdfBuffer || pdfBuffer.length < 2000) {
      throw new Error('Generated PDF is too small or appears empty.');
    }

    return pdfBuffer;
  } catch (error) {
    console.error('❌ PDF generation failed:', error.message);
    throw error;
  } finally {
    await page.close();
  }
}
