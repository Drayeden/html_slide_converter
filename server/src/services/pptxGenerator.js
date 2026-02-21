import PptxGenJS from 'pptxgenjs';

/**
 * Convert RGB/RGBA CSS color to hex color for PptxGenJS.
 * @param {string} cssColor - CSS color string (rgb, rgba, hex, named)
 * @returns {string} Hex color without '#' prefix
 */
function cssColorToHex(cssColor) {
    if (!cssColor) return '000000';

    // Already hex
    if (cssColor.startsWith('#')) {
        return cssColor.replace('#', '').substring(0, 6);
    }

    // rgb(r, g, b) or rgba(r, g, b, a)
    const match = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `${r}${g}${b}`;
    }

    return '000000';
}

/**
 * Map CSS font-weight to PptxGenJS bold flag.
 */
function isBold(fontWeight) {
    if (!fontWeight) return false;
    const w = parseInt(fontWeight);
    if (!isNaN(w)) return w >= 700;
    return fontWeight === 'bold' || fontWeight === 'bolder';
}

/**
 * Convert font size from px to pt (PowerPoint uses points).
 * 1pt = 1.333px (96dpi / 72ppi)
 */
function pxToPt(px) {
    return Math.round(px * 0.75 * 10) / 10;
}

/**
 * Generate a PPTX file with screenshot backgrounds and transparent text overlays.
 * 
 * Strategy: "Image background + invisible text overlay"
 * - Screenshot provides 100% visual fidelity (design, fonts, colors, graphics)
 * - Transparent text overlays enable: text search, copy/paste, and editing in PowerPoint
 * - To edit text visually: select text box → change font color → text becomes visible
 * - This approach eliminates the "double text" rendering issue
 *
 * @param {Buffer[]} screenshots - PNG buffers for each slide
 * @param {Array<Array<TextElement>>} textElements - Text elements per slide (optional)
 * @param {object} options - { textOverlay: boolean, slideSize: { w, h } }
 * @returns {Buffer} PPTX file buffer
 */
export async function generatePptx(screenshots, textElements, options = {}) {
    const {
        textOverlay = true,   // Default ON: transparent text for search/copy/edit
        slideSize = { w: 1280, h: 720 },
    } = options;

    const pptx = new PptxGenJS();

    // Calculate layout dimensions in inches (PowerPoint uses inches)
    // Standard 16:9 = 13.333 x 7.5 inches
    const layoutW = 13.333;
    const layoutH = layoutW * (slideSize.h / slideSize.w);

    pptx.defineLayout({ name: 'CUSTOM', width: layoutW, height: layoutH });
    pptx.layout = 'CUSTOM';

    for (let i = 0; i < screenshots.length; i++) {
        const slide = pptx.addSlide();
        const imgBuffer = screenshots[i];

        // Layer 1: Full-bleed screenshot background (preserves original design exactly)
        const base64Img = imgBuffer.toString('base64');
        slide.addImage({
            data: `image/png;base64,${base64Img}`,
            x: 0,
            y: 0,
            w: layoutW,
            h: layoutH,
        });

        // Layer 2: Transparent text overlays (invisible but selectable/editable)
        // - Text color is fully transparent (transparency: 100)
        // - No fill on text boxes (fill: { type: 'none' })
        // - Zero internal margins for precise coordinate matching
        // - To make text visible for editing: select text box → change font color
        if (textOverlay && textElements && textElements[i]) {
            for (const elem of textElements[i]) {
                // Convert normalized coordinates (0-1) to inches
                const x = elem.x * layoutW;
                const y = elem.y * layoutH;
                const w = elem.width * layoutW;
                const h = elem.height * layoutH;

                // Skip very small or off-screen elements
                if (w < 0.05 || h < 0.03) continue;
                if (x < -0.5 || y < -0.5 || x > layoutW + 0.5 || y > layoutH + 0.5) continue;

                // Skip empty text
                if (!elem.text || !elem.text.trim()) continue;

                try {
                    slide.addText(elem.text, {
                        x,
                        y,
                        w: Math.min(w, layoutW - x),   // Clamp to slide bounds
                        h: Math.min(h, layoutH - y),
                        fontSize: pxToPt(elem.fontSize) || 12,
                        fontFace: elem.fontFamily || 'Arial',
                        color: cssColorToHex(elem.color),
                        bold: isBold(elem.fontWeight),
                        italic: elem.fontStyle === 'italic',
                        align: elem.textAlign === 'center' ? 'center'
                            : elem.textAlign === 'right' ? 'right'
                                : 'left',
                        valign: 'top',
                        // KEY: Make text completely invisible (transparent text fill)
                        // Text is still there for search, copy/paste, and editing
                        // MS-PPT > Format Shape > Text Options > Text Fill > Transparency: 100%
                        transparency: 100,
                        // No background fill on text box
                        fill: { type: 'none' },
                        line: { type: 'none' },
                        // Zero margins for precise coordinate positioning
                        margin: [0, 0, 0, 0],
                        // Prevent auto-sizing that would shift text
                        fit: 'none',
                        shrinkText: false,
                        wrap: true,
                        // Pass through line spacing for accurate vertical rhythm
                        lineSpacingMultiple: elem.lineHeight
                            ? (elem.lineHeight / (elem.fontSize || 16))
                            : undefined,
                    });
                } catch (e) {
                    // Skip problematic text elements silently
                }
            }
        }
    }

    // Generate PPTX buffer
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    return pptxBuffer;
}
