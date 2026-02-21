/**
 * Test script for slideParser functions (Node.js environment).
 * Since slideParser uses DOMParser (browser API), we test the regex/logic functions directly.
 */
import fs from 'fs';

const sampleHtml = fs.readFileSync('../sample_slide.html', 'utf-8');

// === Test 1: URL extraction ===
console.log('\n=== Test 1: iframe URL extraction ===');
const iframeRegex = /src=["'](https?:\/\/page\.gensparksite\.com\/slide_agent\/[^"']+\.html)["']/gi;
const testHtml = `<iframe src="https://page.gensparksite.com/slide_agent/abc123/slide1.html"></iframe>
<iframe src="https://page.gensparksite.com/slide_agent/abc123/slide2.html"></iframe>`;
const matches = [];
let m;
while ((m = iframeRegex.exec(testHtml)) !== null) matches.push(m[1]);
console.log(`Found ${matches.length} URLs:`, matches);
console.log(matches.length === 2 ? '✅ PASS' : '❌ FAIL');

// === Test 2: Slide size detection (multi-line CSS) ===
console.log('\n=== Test 2: detectSlideSize (dotAll) ===');
const slideBlockMatch = sampleHtml.match(/\.slide\s*\{([^}]*)\}/s);
if (slideBlockMatch) {
    const block = slideBlockMatch[1];
    const wMatch = block.match(/width:\s*(\d+)px/);
    const hMatch = block.match(/height:\s*(\d+)px/);
    const w = wMatch ? parseInt(wMatch[1]) : null;
    const h = hMatch ? parseInt(hMatch[1]) : null;
    console.log(`Detected size: ${w}×${h}`);
    console.log(w === 1280 && h === 720 ? '✅ PASS' : '❌ FAIL');
} else {
    console.log('❌ FAIL — .slide block not found');
}

// === Test 3: Badge script removal ===
console.log('\n=== Test 3: Genspark badge removal ===');
let cleaned = sampleHtml;

// Remove slide-inner.js
cleaned = cleaned.replace(/<script[^>]*src=['"][^'"]*genspark\.ai\/slide-inner\.js[^'"]*['"][^>]*>\s*<\/script>/gi, '');

// Remove html_badge_script blocks
cleaned = cleaned.replace(/<script[^>]*id=['"]html_badge_script\d*['"][^>]*>[\s\S]*?<\/script>/gi, '');

// Remove scripts with genspark globals
cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_remove_badge_link[\s\S]*?<\/script>/gi, '');
cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_token[\s\S]*?<\/script>/gi, '');
cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?__genspark_locale[\s\S]*?<\/script>/gi, '');

// Clean after </html>
cleaned = cleaned.replace(/(<\/html>)\s*$/i, '$1');
cleaned = cleaned.trim();

const hasSlideInner = cleaned.includes('slide-inner.js');
const hasBadgeScript = cleaned.includes('html_badge_script');
const hasGensparkToken = cleaned.includes('__genspark_token');
const hasGensparkLocale = cleaned.includes('__genspark_locale');
const hasGensparkBadge = cleaned.includes('__genspark_remove_badge_link');
const endsWithHtml = cleaned.trim().endsWith('</html>');

console.log(`slide-inner.js removed: ${!hasSlideInner ? '✅' : '❌'}`);
console.log(`html_badge_script removed: ${!hasBadgeScript ? '✅' : '❌'}`);
console.log(`__genspark_token removed: ${!hasGensparkToken ? '✅' : '❌'}`);
console.log(`__genspark_locale removed: ${!hasGensparkLocale ? '✅' : '❌'}`);
console.log(`__genspark_remove_badge_link removed: ${!hasGensparkBadge ? '✅' : '❌'}`);
console.log(`Ends with </html>: ${endsWithHtml ? '✅' : '❌'}`);

const allPass = !hasSlideInner && !hasBadgeScript && !hasGensparkToken && !hasGensparkLocale && !hasGensparkBadge && endsWithHtml;
console.log(allPass ? '\n✅ ALL TESTS PASSED' : '\n❌ SOME TESTS FAILED');

// Show cleaned result length
console.log(`\nOriginal: ${sampleHtml.length} bytes → Cleaned: ${cleaned.length} bytes (removed ${sampleHtml.length - cleaned.length} bytes)`);
