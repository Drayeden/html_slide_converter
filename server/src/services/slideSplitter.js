/**
 * Server-side HTML slide splitter.
 * Splits a single HTML document containing multiple div.slide elements
 * into individual complete HTML documents, one per slide.
 *
 * Uses cheerio for robust HTML parsing.
 */
import { load } from 'cheerio';

const SLIDE_SELECTORS = [
    'div.slide',
    'section.slide',
    '.slide',
    'section[data-slide]',
    '[data-slide]',
    '.swiper-slide',
];

// Genspark badge patterns to remove
const BADGE_SCRIPT_PATTERNS = [
    /genspark\.ai\/slide-inner\.js/i,
    /html_badge_script/i,
    /__genspark_remove_badge_link/i,
    /__genspark_token/i,
    /__genspark_locale/i,
];

/**
 * Split multi-slide HTML into individual slide HTML documents.
 * @param {string} html - Raw HTML (may contain 1 or N slides)
 * @returns {{ slides: string[], slideSize: { w: number, h: number } }}
 */
export function splitSlides(htmlInput) {
    // Ensure input is a string
    const html = typeof htmlInput === 'string' ? htmlInput : String(htmlInput || '');
    if (!html.trim()) {
        return { slides: [], slideSize: { w: 1280, h: 720 } };
    }

    // Step 0: Check for Genspark viewer page (tabs + HLJS code blocks)
    const viewerResult = extractSlidesFromGensparkViewer(html);
    if (viewerResult) {
        return viewerResult;
    }

    // Detect slide size from CSS before parsing
    const slideSize = detectSlideSize(html);

    let $;
    try {
        $ = load(html);
    } catch (e) {
        console.error('❌ cheerio.load failed:', e.message);
        return { slides: [html], slideSize };
    }

    // Remove Genspark badge scripts
    $('script').each(function () {
        const el = $(this);
        const src = el.attr('src') || '';
        const id = el.attr('id') || '';
        const content = el.html() || '';
        for (const pattern of BADGE_SCRIPT_PATTERNS) {
            if (pattern.test(src) || pattern.test(id) || pattern.test(content)) {
                el.remove();
                return;
            }
        }
    });

    // Collect <head> content
    const headContent = $('head').html() || '';

    // Find slide elements
    let slideEls = [];
    let matchedSelector = '';
    for (const selector of SLIDE_SELECTORS) {
        try {
            const found = $(selector);
            if (found.length >= 1) {
                slideEls = found.toArray();
                matchedSelector = selector;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    console.log(`  🔍 Found ${slideEls.length} slide elements with selector "${matchedSelector}"`);

    // If no slide elements or only 1 found, return cleaned full document
    if (slideEls.length <= 1) {
        return {
            slides: [$.html()],
            slideSize,
        };
    }

    // Multiple slides: wrap each in a complete HTML document
    const slides = slideEls.map(el => {
        const slideHtml = $(el).prop('outerHTML') || $.html(el);
        return `<!DOCTYPE html>
<html>
<head>
${headContent}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
    width: ${slideSize.w}px;
    height: ${slideSize.h}px;
    overflow: hidden;
}
</style>
</head>
<body>
${slideHtml}
</body>
</html>`;
    });

    return { slides, slideSize };
}

/**
 * Process slides array — split any multi-slide entries into individual slides.
 * @param {string[]} slidesInput - Array of HTML strings
 * @returns {{ slides: string[], slideSize: { w: number, h: number } }}
 */
export function processSlides(slidesInput) {
    if (!slidesInput || slidesInput.length === 0) {
        return { slides: [], slideSize: { w: 1280, h: 720 } };
    }

    const allSlides = [];
    let detectedSize = { w: 1280, h: 720 };

    for (const item of slidesInput) {
        const html = typeof item === 'string' ? item : String(item || '');
        const { slides, slideSize } = splitSlides(html);
        allSlides.push(...slides);
        if (slideSize.w !== 1280 || slideSize.h !== 720) {
            detectedSize = slideSize;
        }
    }

    return { slides: allSlides, slideSize: detectedSize };
}

/**
 * Detect slide dimensions from CSS in HTML.
 */
function detectSlideSize(html) {
    const slideBlockMatch = html.match(/\.slide\s*\{([^}]*)\}/s);
    if (slideBlockMatch) {
        const block = slideBlockMatch[1];
        const wMatch = block.match(/width:\s*(\d+)px/);
        const hMatch = block.match(/height:\s*(\d+)px/);
        return {
            w: wMatch ? parseInt(wMatch[1]) : 1280,
            h: hMatch ? parseInt(hMatch[1]) : 720,
        };
    }
    return { w: 1280, h: 720 };
}

/**
 * Detect Genspark viewer page HTML and extract slides from HLJS code blocks.
 * Uses cheerio for server-side parsing.
 *
 * Genspark viewer pages have:
 *   div.tab-item#slide-item-0 > ... > code.hljs.language-html  (HLJS-highlighted HTML)
 *
 * @param {string} html - Raw HTML
 * @returns {object|null} - { slides, slideSize } or null
 */
function extractSlidesFromGensparkViewer(html) {
    // Quick check: must contain HLJS markers AND tab-item markers
    if (!html.includes('hljs-tag') || !html.includes('tab-item')) {
        return null;
    }

    let $;
    try {
        $ = load(html);
    } catch (e) {
        return null;
    }

    // Find all slide tab items
    const tabItems = $('.tab-item[id^="slide-item-"]');
    if (tabItems.length === 0) {
        return null;
    }

    console.log(`🔍 Genspark viewer detected: ${tabItems.length} slide items found`);

    const slides = [];

    tabItems.each(function (index) {
        const tabItem = $(this);
        // Find the code block inside this tab item
        const codeEl = tabItem.find('code.hljs');
        if (codeEl.length === 0) {
            console.warn(`  ⚠️ Slide ${index}: no code.hljs element found`);
            return;
        }

        // Use .text() to strip all HLJS span tags and get raw HTML source
        let rawHtml = codeEl.text();

        // Only fix double-escaped entities if actually present (preserve original otherwise)
        if (rawHtml.includes('&amp;') || rawHtml.includes('&lt;') || rawHtml.includes('&gt;')) {
            rawHtml = fixHtmlEntities(rawHtml);
        }

        // Remove "Copy" button text injected by Genspark viewer at the top of code blocks
        rawHtml = rawHtml.replace(/^Copy( code)?\s*/i, '');

        if (rawHtml.trim()) {
            slides.push(rawHtml.trim());
            console.log(`  ✅ Slide ${index + 1}: ${rawHtml.length} chars extracted`);
        }
    });

    if (slides.length === 0) {
        return null;
    }

    // Detect slide size from the first slide
    const slideSize = detectSlideSize(slides[0]);

    return { slides, slideSize };
}

/**
 * Fix double-escaped HTML entities from Genspark viewer code blocks.
 * Only fixes patterns that are clearly double-escaped to preserve original content.
 */
function fixHtmlEntities(html) {
    let result = html;
    // Only fix genuinely double-escaped entities
    result = result.replace(/&amp;amp;/g, '&amp;');
    result = result.replace(/&amp;lt;/g, '&lt;');
    result = result.replace(/&amp;gt;/g, '&gt;');
    result = result.replace(/&amp;quot;/g, '&quot;');
    result = result.replace(/&amp;#(\d+);/g, '&#$1;');
    result = result.replace(/&amp;([a-zA-Z]+);/g, '&$1;');
    return result;
}
