/**
 * Parse HTML code to extract individual slides.
 * Supports Genspark's actual slide structure:
 * - External iframe URLs (page.gensparksite.com)
 * - Inline HTML with div.slide
 * - Various other slide selectors
 */

const SLIDE_SELECTORS = [
    'div.slide',
    'section.slide',
    '.slide',
    'section[data-slide]',
    '[data-slide]',
    '.swiper-slide',
    'section',
];

/**
 * Parse complete HTML code into individual slide HTML strings.
 * Supports two modes:
 * 1. iframe URL extraction (from Genspark conversation page)
 * 2. Inline HTML parsing (from individual slide code)
 *
 * @param {string} code - Full HTML code from Genspark
 * @returns {{ slides: string[], urls: string[], styles: string, scripts: string, mode: 'url'|'html', slideSize: {w:number, h:number} }}
 */
export function parseSlides(code) {
    if (!code || !code.trim()) {
        return { slides: [], urls: [], styles: '', scripts: '', mode: 'html', slideSize: { w: 1280, h: 720 } };
    }

    // Step 0: Check for Genspark viewer page (tabs-container with HLJS code blocks)
    const viewerResult = extractSlidesFromGensparkViewer(code);
    if (viewerResult) {
        return viewerResult;
    }

    // Step 1: Check for Genspark iframe URLs
    const urls = extractGensparkUrls(code);
    if (urls.length > 0) {
        return {
            slides: [],
            urls,
            styles: '',
            scripts: '',
            mode: 'url',
            slideSize: { w: 1280, h: 720 }, // Genspark default
        };
    }

    // Step 2: Clean Genspark badge scripts BEFORE parsing
    const cleanedCode = cleanGensparkScripts(code);

    // Step 3: Regular HTML parsing mode
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedCode, 'text/html');

    // Extract styles
    const styleElements = doc.querySelectorAll('style');
    let styles = '';
    styleElements.forEach(el => {
        styles += el.outerHTML + '\n';
    });

    const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
    linkElements.forEach(el => {
        styles += el.outerHTML + '\n';
    });

    // Extract scripts (excluding any remaining Genspark badge scripts)
    const scriptElements = doc.querySelectorAll('script');
    let scripts = '';
    scriptElements.forEach(el => {
        if (isGensparkBadgeScript(el)) return;
        scripts += el.outerHTML + '\n';
    });

    // Detect slide size from CSS
    const slideSize = detectSlideSize(cleanedCode);

    // Try each slide selector — accept 1 or more slides
    let slideElements = [];
    for (const selector of SLIDE_SELECTORS) {
        try {
            const found = doc.querySelectorAll(selector);
            if (found.length >= 1) {
                slideElements = Array.from(found);
                break;
            }
        } catch (e) {
            continue;
        }
    }

    // Check if input is already a complete HTML document for a single slide
    const isCompleteHtml = cleanedCode.trim().toLowerCase().startsWith('<!doctype') ||
        cleanedCode.trim().toLowerCase().startsWith('<html');

    if (slideElements.length === 0) {
        if (isCompleteHtml) {
            // Single complete HTML slide — use as-is after cleaning
            return {
                slides: [cleanedCode],
                urls: [],
                styles,
                scripts,
                mode: 'html',
                slideSize,
            };
        }

        // Treat entire body as one slide
        const bodyContent = doc.body ? doc.body.innerHTML : cleanedCode;
        return {
            slides: [wrapSlideHtml(bodyContent, styles, scripts, slideSize)],
            urls: [],
            styles,
            scripts,
            mode: 'html',
            slideSize,
        };
    }

    // For complete HTML with a single slide element, return cleaned original
    if (isCompleteHtml && slideElements.length === 1) {
        return {
            slides: [cleanedCode],
            urls: [],
            styles,
            scripts,
            mode: 'html',
            slideSize,
        };
    }

    // Build individual slide HTML strings for multiple slides
    const slides = slideElements.map(el => {
        return wrapSlideHtml(el.outerHTML, styles, scripts, slideSize);
    });

    return { slides, urls: [], styles, scripts, mode: 'html', slideSize };
}

/**
 * Extract Genspark slide iframe URLs from conversation HTML.
 */
function extractGensparkUrls(code) {
    const urls = [];
    // Match iframe src pointing to page.gensparksite.com
    // Handle both single and double quotes, and escaped quotes
    const iframeRegex = /src=["'](https?:\/\/page\.gensparksite\.com\/slide_agent\/[^"']+\.html)["']/gi;
    let match;
    while ((match = iframeRegex.exec(code)) !== null) {
        const url = match[1];
        // Avoid duplicates
        if (!urls.includes(url)) {
            urls.push(url);
        }
    }
    return urls;
}

/**
 * Detect slide dimensions from CSS.
 * Uses dotAll flag (s) to match across newlines within CSS blocks.
 */
function detectSlideSize(code) {
    // Match .slide { ... width: Npx ... } across multiple lines
    const slideBlockMatch = code.match(/\.slide\s*\{([^}]*)\}/s);
    if (slideBlockMatch) {
        const block = slideBlockMatch[1];
        const wMatch = block.match(/width:\s*(\d+)px/);
        const hMatch = block.match(/height:\s*(\d+)px/);
        const w = wMatch ? parseInt(wMatch[1]) : 1280;
        const h = hMatch ? parseInt(hMatch[1]) : 720;
        return { w, h };
    }

    return { w: 1280, h: 720 };
}

/**
 * Check if a script element is a Genspark badge script.
 */
function isGensparkBadgeScript(el) {
    const src = el.getAttribute('src') || '';
    const id = el.getAttribute('id') || '';
    const content = el.textContent || '';

    if (src.includes('genspark.ai/slide-inner.js')) return true;
    if (src.includes('genspark.ai')) return true;
    if (/html_badge_script/i.test(id)) return true;
    if (content.includes('__genspark_remove_badge_link')) return true;
    if (content.includes('__genspark_token')) return true;
    if (content.includes('__genspark_locale')) return true;

    return false;
}

/**
 * Remove Genspark badge/tracking scripts from HTML string.
 * Handles scripts that appear after </html> tag (common in Genspark output).
 */
function cleanGensparkScripts(html) {
    let cleaned = html;

    // Remove slide-inner.js script tags (handles both quote styles)
    cleaned = cleaned.replace(/<script[^>]*src=['"][^'"]*genspark\.ai\/slide-inner\.js[^'"]*['"][^>]*>\s*<\/script>/gi, '');

    // Remove html_badge_script blocks (content can be multi-line)
    cleaned = cleaned.replace(/<script[^>]*id=['"]html_badge_script\d*['"][^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove any remaining script tags containing genspark-specific globals
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_remove_badge_link[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_token[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_locale[\s\S]*?<\/script>/gi, '');

    // Clean up any content after </html> (whitespace/newlines)
    cleaned = cleaned.replace(/(<\/html>)\s*$/i, '$1');

    return cleaned.trim();
}

/**
 * Wrap slide content with full HTML document structure.
 */
function wrapSlideHtml(content, styles = '', scripts = '', slideSize = { w: 1280, h: 720 }) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${styles}
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
  ${content}
  ${scripts}
</body>
</html>`;
}

/**
 * Get the raw inner HTML of a slide (without wrapper).
 */
export function getSlideContent(slideHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(slideHtml, 'text/html');
    return doc.body ? doc.body.innerHTML : slideHtml;
}

/**
 * Check if HTML is a complete document (has <html> tag).
 */
export function isCompleteHtmlDocument(html) {
    const trimmed = html.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

/**
 * Detect Genspark viewer page HTML and extract slides from HLJS code blocks.
 * 
 * Genspark viewer pages have this structure:
 *   div.tabs-container
 *     div.tab-item#slide-item-0
 *       div.code-preview-container
 *         div.content-area
 *           div.tab-pane (코드 탭)
 *             pre > code.hljs.language-html  ← HLJS-highlighted HTML source
 *     div.tab-item#slide-item-1
 *       ...
 *
 * @param {string} code - Raw HTML from the Genspark viewer page
 * @returns {object|null} - Parsed slides result, or null if not a viewer page
 */
function extractSlidesFromGensparkViewer(code) {
    // Quick check: must contain HLJS markers AND tab-item markers
    if (!code.includes('hljs-tag') || !code.includes('tab-item')) {
        return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');

    // Find all slide tab items
    const tabItems = doc.querySelectorAll('.tab-item[id^="slide-item-"]');
    if (tabItems.length === 0) {
        return null;
    }

    console.log(`🔍 Genspark viewer detected: ${tabItems.length} slide items found`);

    const slides = [];

    tabItems.forEach((tabItem, index) => {
        // Find the code block inside this tab item
        // It's in: .content-area > .tab-pane (2nd one) > .code-renderer > pre > code.hljs
        const codeEl = tabItem.querySelector('code.hljs');
        if (!codeEl) {
            console.warn(`  ⚠️ Slide ${index}: no code.hljs element found`);
            return;
        }

        // Use textContent to strip all HLJS span tags and get raw HTML source
        let rawHtml = codeEl.textContent;

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

    // Extract styles/scripts from the first slide to pass through for downstream use
    let styles = '';
    let scripts = '';
    try {
        const firstDoc = new DOMParser().parseFromString(slides[0], 'text/html');
        firstDoc.querySelectorAll('style').forEach(el => { styles += el.outerHTML + '\n'; });
        firstDoc.querySelectorAll('link[rel="stylesheet"]').forEach(el => { styles += el.outerHTML + '\n'; });
        firstDoc.querySelectorAll('script').forEach(el => {
            if (!isGensparkBadgeScript(el)) scripts += el.outerHTML + '\n';
        });
    } catch (e) { /* ignore parse errors */ }

    return {
        slides,
        urls: [],
        styles,
        scripts,
        mode: 'html',
        slideSize,
    };
}

/**
 * Fix double-escaped HTML entities commonly found in Genspark viewer code blocks.
 * Only fixes patterns that are clearly double-escaped to preserve original content.
 * e.g. &amp;amp; → &amp;  (but leaves single &amp; alone)
 */
function fixHtmlEntities(html) {
    let result = html;
    // Only fix genuinely double-escaped entities (amp;amp; → amp;)
    // Single-escaped entities are already correct and should not be touched
    result = result.replace(/&amp;amp;/g, '&amp;');
    result = result.replace(/&amp;lt;/g, '&lt;');
    result = result.replace(/&amp;gt;/g, '&gt;');
    result = result.replace(/&amp;quot;/g, '&quot;');
    result = result.replace(/&amp;#(\d+);/g, '&#$1;');
    result = result.replace(/&amp;([a-zA-Z]+);/g, '&$1;');
    return result;
}
