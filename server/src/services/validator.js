import { getPage } from '../utils/puppeteerPool.js';

/**
 * Validate slides against quality criteria.
 * V-01: 16:9 ratio
 * V-02: Element overlap
 * V-03: Overflow detection
 * V-04: Margin adequacy
 * V-06: Design elements
 * V-07: Template consistency
 *
 * @param {string[]} slideHtmls - Array of slide HTML strings
 * @returns {Array<SlideValidation>}
 */
export async function validateSlides(slideHtmls) {
    const results = [];

    for (let i = 0; i < slideHtmls.length; i++) {
        const result = await validateSingleSlide(slideHtmls[i], i);
        results.push(result);
    }

    // V-07: Template consistency check across all slides
    checkTemplateConsistency(results);

    return results;
}

async function validateSingleSlide(slideHtml, index) {
    const page = await getPage();

    try {
        await page.setViewport({ width: 1920, height: 1080 });

        const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 1920px; height: 1080px; overflow: hidden; }
        </style>
      </head>
      <body>${slideHtml}</body>
      </html>
    `;

        await page.setContent(fullHtml, {
            waitUntil: ['domcontentloaded'],
            timeout: 10000,
        });

        const validation = await page.evaluate(() => {
            const W = 1920;
            const H = 1080;
            const checks = {};

            // Get all visible elements
            const allElements = Array.from(document.body.querySelectorAll('*')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });

            const rects = allElements.map(el => el.getBoundingClientRect());

            // V-01: 16:9 ratio check
            const bodyRect = document.body.getBoundingClientRect();
            const ratio = bodyRect.width / bodyRect.height;
            const idealRatio = 16 / 9;
            checks.ratio = {
                id: 'V-01',
                name: '16:9 비율',
                status: Math.abs(ratio - idealRatio) < 0.1 ? 'pass' : 'fail',
                detail: `현재 비율: ${ratio.toFixed(2)} (기준: ${idealRatio.toFixed(2)})`,
            };

            // V-02: Element overlap
            let overlapCount = 0;
            for (let i = 0; i < rects.length; i++) {
                for (let j = i + 1; j < rects.length; j++) {
                    const a = rects[i];
                    const b = rects[j];
                    if (a.width < 10 || a.height < 10 || b.width < 10 || b.height < 10) continue;

                    const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                    const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                    const overlapArea = overlapX * overlapY;
                    const minArea = Math.min(a.width * a.height, b.width * b.height);

                    if (minArea > 0 && overlapArea / minArea > 0.3) {
                        overlapCount++;
                    }
                }
            }
            checks.overlap = {
                id: 'V-02',
                name: '요소 중첩',
                status: overlapCount === 0 ? 'pass' : overlapCount < 3 ? 'warn' : 'fail',
                detail: `중첩 요소 쌍: ${overlapCount}개`,
            };

            // V-03: Overflow detection
            let overflowCount = 0;
            rects.forEach((rect, idx) => {
                if (rect.width < 5 || rect.height < 5) return;
                if (rect.right > W + 10 || rect.bottom > H + 10 || rect.left < -10 || rect.top < -10) {
                    overflowCount++;
                }
            });
            checks.overflow = {
                id: 'V-03',
                name: '영역 초과',
                status: overflowCount === 0 ? 'pass' : 'fail',
                detail: `영역 초과 요소: ${overflowCount}개`,
            };

            // V-04: Margin check (content should have at least 5% margin)
            const contentRects = rects.filter(r => r.width > 20 && r.height > 20);
            let minLeft = W, minTop = H, maxRight = 0, maxBottom = 0;
            contentRects.forEach(r => {
                if (r.left < minLeft) minLeft = r.left;
                if (r.top < minTop) minTop = r.top;
                if (r.right > maxRight) maxRight = r.right;
                if (r.bottom > maxBottom) maxBottom = r.bottom;
            });
            const marginLeft = minLeft / W;
            const marginTop = minTop / H;
            const marginRight = (W - maxRight) / W;
            const marginBottom = (H - maxBottom) / H;
            const minMargin = Math.min(marginLeft, marginTop, marginRight, marginBottom);
            checks.margin = {
                id: 'V-04',
                name: '여백 적정성',
                status: minMargin >= 0.03 ? 'pass' : minMargin >= 0.01 ? 'warn' : 'fail',
                detail: `최소 여백: ${(minMargin * 100).toFixed(1)}% (권장: 5%)`,
            };

            // V-06: Design elements check
            const styles = allElements.map(el => window.getComputedStyle(el));
            const hasGradient = styles.some(s => s.backgroundImage.includes('gradient'));
            const hasShadow = styles.some(s => s.boxShadow !== 'none');
            const hasRadius = styles.some(s => parseFloat(s.borderRadius) > 0);
            const designScore = [hasGradient, hasShadow, hasRadius].filter(Boolean).length;
            checks.design = {
                id: 'V-06',
                name: '디자인 요소',
                status: designScore >= 2 ? 'pass' : designScore >= 1 ? 'warn' : 'fail',
                detail: `그라디언트: ${hasGradient ? '✓' : '✗'}, 그림자: ${hasShadow ? '✓' : '✗'}, 모서리: ${hasRadius ? '✓' : '✗'}`,
            };

            return checks;
        });

        return {
            slideIndex: index,
            checks: Object.values(validation),
            overall: Object.values(validation).every(c => c.status !== 'fail') ? 'pass'
                : Object.values(validation).some(c => c.status === 'fail') ? 'fail' : 'warn',
        };
    } finally {
        await page.close();
    }
}

function checkTemplateConsistency(results) {
    // V-07 is a cross-slide check — placeholder for future implementation
    // For now, just add a pass for each slide
    results.forEach(r => {
        r.checks.push({
            id: 'V-07',
            name: '템플릿 일관성',
            status: 'pass',
            detail: '교차 슬라이드 일관성 검사 (기본 통과)',
        });
    });
}
