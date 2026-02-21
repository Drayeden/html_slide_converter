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
      // Use iframe approach for each slide
      const slidesHtml = slideHtmls.map((html, i) => {
        // Extract body content from complete HTML
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        const bodyContent = bodyMatch ? bodyMatch[1] : html;
        const headContent = headMatch ? headMatch[1] : '';

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

      // Extract styles from first slide for shared CSS
      const firstHeadMatch = slideHtmls[0]?.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const sharedHead = firstHeadMatch ? firstHeadMatch[1] : '';

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
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 60000,
    });

    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 800));

    const pdfBuffer = await page.pdf({
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}
