import { getPage } from '../utils/puppeteerPool.js';

/**
 * Extract text elements with positions and styles from a slide.
 * Supports dynamic slide sizes and complete HTML documents.
 *
 * @param {string} slideHtml - Complete HTML for one slide
 * @param {object} slideSize - { w, h } slide dimensions
 * @returns {Array<TextElement>}
 */
export async function extractTextElements(slideHtml, slideSize = { w: 1280, h: 720 }) {
    const page = await getPage();

    try {
        const { w: SLIDE_W, h: SLIDE_H } = slideSize;
        await page.setViewport({ width: SLIDE_W, height: SLIDE_H });

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
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${SLIDE_W}px; height: ${SLIDE_H}px; overflow: hidden; }
        </style>
      </head>
      <body>${slideHtml}</body>
      </html>
      `;
        }

        await page.setContent(fullHtml, {
            waitUntil: ['networkidle2', 'domcontentloaded'],
            timeout: 30000,
        });

        await page.evaluate(() => document.fonts.ready);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Extract all visible text elements with background colors
        const textElements = await page.evaluate((sw, sh) => {
            const elements = [];

            /**
             * Walk up the DOM tree to find the effective (non-transparent) background color.
             * Handles: solid colors, gradients (extracts first color), and transparency.
             */
            function getEffectiveBackgroundColor(el) {
                let current = el;
                while (current && current !== document.documentElement) {
                    const style = window.getComputedStyle(current);
                    const bg = style.backgroundColor;
                    const bgImage = style.backgroundImage;

                    // Check for gradient background — extract first color
                    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
                        const colorMatch = bgImage.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/);
                        if (colorMatch) return colorMatch[0];
                        const hexMatch = bgImage.match(/#[0-9a-fA-F]{3,8}/);
                        if (hexMatch) return hexMatch[0];
                    }

                    // Check for solid background color
                    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                        // Parse rgba to check alpha
                        const rgbaMatch = bg.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
                        if (rgbaMatch) {
                            const alpha = parseFloat(rgbaMatch[4]);
                            if (alpha > 0.1) return bg; // Consider non-transparent if alpha > 0.1
                        } else {
                            // rgb() without alpha — fully opaque
                            return bg;
                        }
                    }

                    current = current.parentElement;
                }
                // Default: white background
                return 'rgb(255, 255, 255)';
            }

            function walkTextNodes(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = node.tagName.toLowerCase();
                    if (['script', 'style', 'svg', 'canvas', 'link', 'meta'].includes(tag)) return;

                    const style = window.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;

                    // Check if this element has direct text content
                    const hasDirectText = Array.from(node.childNodes).some(
                        child => child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0
                    );

                    if (hasDirectText) {
                        const rect = node.getBoundingClientRect();
                        const text = node.innerText || node.textContent;
                        const trimmedText = text.trim();

                        // Filter out "Copy" buttons from Genspark viewer
                        if (trimmedText.toLowerCase() === 'copy') return;

                        if (trimmedText && rect.width > 0 && rect.height > 0) {
                            const fontSize = parseFloat(style.fontSize);
                            const lineHeight = style.lineHeight === 'normal'
                                ? fontSize * 1.2
                                : parseFloat(style.lineHeight);

                            elements.push({
                                text: text.trim(),
                                x: rect.left / sw,
                                y: rect.top / sh,
                                width: rect.width / sw,
                                height: rect.height / sh,
                                fontSize,
                                fontFamily: style.fontFamily.replace(/['"]/g, '').split(',')[0].trim(),
                                fontWeight: style.fontWeight,
                                fontStyle: style.fontStyle,
                                color: style.color,
                                backgroundColor: getEffectiveBackgroundColor(node),
                                textAlign: style.textAlign,
                                lineHeight,
                                textDecoration: style.textDecoration,
                            });
                        }
                    }
                }

                for (const child of node.children || []) {
                    walkTextNodes(child);
                }
            }

            walkTextNodes(document.body);
            return elements;
        }, SLIDE_W, SLIDE_H);

        return textElements;
    } finally {
        await page.close();
    }
}

/**
 * Extract text elements from multiple slides.
 * @param {string[]} slideHtmls
 * @param {object} slideSize - { w, h }
 * @returns {Array<Array<TextElement>>}
 */
export async function extractAllTextElements(slideHtmls, slideSize = { w: 1280, h: 720 }) {
    const results = [];
    for (const html of slideHtmls) {
        const texts = await extractTextElements(html, slideSize);
        results.push(texts);
    }
    return results;
}
