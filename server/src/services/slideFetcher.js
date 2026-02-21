/**
 * Fetch individual slide HTML from Genspark URLs.
 * Downloads each slide's HTML and cleans up badge scripts.
 */

/**
 * Fetch multiple slide HTMLs from Genspark URLs in parallel.
 * @param {string[]} urls - Array of slide HTML URLs
 * @param {function} onProgress - Progress callback (current, total)
 * @returns {Promise<{htmls: string[], slideSize: {w: number, h: number}}>}
 */
export async function fetchSlideHtmls(urls, onProgress = null) {
    const htmls = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(url => fetchSingleSlide(url))
        );
        htmls.push(...results);

        if (onProgress) {
            onProgress(Math.min(i + BATCH_SIZE, urls.length), urls.length);
        }
    }

    // Detect slide size from first slide
    const slideSize = detectSlideSizeFromHtml(htmls[0] || '');

    return { htmls, slideSize };
}

/**
 * Fetch a single slide HTML and clean it.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchSingleSlide(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            timeout: 15000,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let html = await response.text();
        html = cleanGensparkBadge(html);
        return html;
    } catch (error) {
        console.error(`❌ Failed to fetch slide: ${url}`, error.message);
        throw new Error(`슬라이드 다운로드 실패: ${url} — ${error.message}`);
    }
}

/**
 * Remove Genspark badge/tracking scripts from slide HTML.
 */
function cleanGensparkBadge(html) {
    let cleaned = html;

    // Remove slide-inner.js script tag
    cleaned = cleaned.replace(
        /<script[^>]*src=['"][^'"]*genspark\.ai\/slide-inner\.js[^'"]*['"][^>]*>\s*<\/script>/gi,
        ''
    );

    // Remove html_badge_script blocks (multi-line content)
    cleaned = cleaned.replace(
        /<script[^>]*id=['"]html_badge_script\d*['"][^>]*>[\s\S]*?<\/script>/gi,
        ''
    );

    // Remove scripts containing genspark globals
    cleaned = cleaned.replace(
        /<script[^>]*>[\s\S]*?__genspark_remove_badge_link[\s\S]*?<\/script>/gi,
        ''
    );
    cleaned = cleaned.replace(
        /<script[^>]*>[\s\S]*?__genspark_token[\s\S]*?<\/script>/gi,
        ''
    );
    cleaned = cleaned.replace(
        /<script[^>]*>[\s\S]*?__genspark_locale[\s\S]*?<\/script>/gi,
        ''
    );

    // Clean up content after </html>
    cleaned = cleaned.replace(/(<\/html>)\s*$/i, '$1');

    return cleaned.trim();
}

/**
 * Detect slide dimensions from HTML CSS.
 */
function detectSlideSizeFromHtml(html) {
    // Use dotAll flag (s) to match across newlines in CSS blocks
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
