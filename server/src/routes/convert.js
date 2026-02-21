import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { captureSlides } from '../services/slideCapture.js';
import { extractAllTextElements } from '../services/textExtractor.js';
import { generatePptx } from '../services/pptxGenerator.js';
import { generatePdf } from '../services/pdfGenerator.js';
import { fetchSlideHtmls } from '../services/slideFetcher.js';
import { processSlides } from '../services/slideSplitter.js';
import { generateFilename, getVerifiedFilename, getOutputDir, getOutputPath } from '../utils/fileHelper.js';

const router = Router();

/**
 * POST /api/convert
 * Convert HTML slides to PPTX + PDF.
 * Body: { slides?: string[], urls?: string[], slideSize?: { w, h } }
 */
router.post('/convert', async (req, res) => {
    try {
        let { slides, urls, slideSize } = req.body;

        // Default slide size
        if (!slideSize) {
            slideSize = { w: 1280, h: 720 };
        }

        // Mode 1: URL-based input — fetch HTML from Genspark URLs
        if (urls && Array.isArray(urls) && urls.length > 0) {
            if (urls.length > 100) {
                return res.status(400).json({ error: '최대 100장까지 변환 가능합니다.' });
            }

            console.log(`🌐 Fetching ${urls.length} slides from Genspark URLs...`);
            const fetchResult = await fetchSlideHtmls(urls, (current, total) => {
                console.log(`  📥 Downloaded ${current}/${total}`);
            });

            slides = fetchResult.htmls;
            slideSize = fetchResult.slideSize;
            console.log(`  📐 Detected slide size: ${slideSize.w}×${slideSize.h}`);
        }

        // Validate slides
        if (!slides || !Array.isArray(slides) || slides.length === 0) {
            return res.status(400).json({ error: 'slides 배열 또는 urls 배열이 필요합니다.' });
        }

        if (slides.length > 100) {
            return res.status(400).json({ error: '최대 100장까지 변환 가능합니다.' });
        }

        // Split multi-slide HTML entries into individual slides
        try {
            const processed = processSlides(slides);
            slides = processed.slides;
            if (processed.slideSize.w !== 1280 || processed.slideSize.h !== 720) {
                slideSize = processed.slideSize;
            }
            console.log(`📑 Processed: ${slides.length} individual slides (${slideSize.w}×${slideSize.h})`);
        } catch (splitErr) {
            console.error('❌ processSlides error:', splitErr.message, splitErr.stack);
            fs.writeFileSync(path.join(getOutputDir(), 'split_error.log'), `${splitErr.message}\n${splitErr.stack}\n`);
            return res.status(500).json({ error: 'Slide splitting failed', detail: splitErr.message });
        }

        const filename = generateFilename();
        console.log(`📸 Capturing ${slides.length} slides...`);

        // Step 1: Capture screenshots
        const screenshots = await captureSlides(slides, (current, total) => {
            console.log(`  📷 Slide ${current}/${total}`);
        }, slideSize);

        // Step 2: Extract text elements for hybrid overlay
        console.log(`📝 Extracting text elements...`);
        const textElements = await extractAllTextElements(slides, slideSize);

        // Step 3: Generate PPTX
        console.log(`📊 Generating PPTX...`);
        const pptxBuffer = await generatePptx(screenshots, textElements, { slideSize });
        const pptxPath = getOutputPath(filename, 'pptx');
        fs.writeFileSync(pptxPath, pptxBuffer);
        console.log(`  ✅ PPTX saved: ${pptxPath}`);

        // Step 4: Generate PDF
        console.log(`📄 Generating PDF...`);
        const pdfBuffer = await generatePdf(slides, slideSize);
        const pdfPath = getOutputPath(filename, 'pdf');
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`  ✅ PDF saved: ${pdfPath}`);

        res.json({
            success: true,
            filename,
            pptxUrl: `/api/download/${filename}.pptx`,
            pdfUrl: `/api/download/${filename}.pdf`,
            slidesCount: slides.length,
            slideSize,
        });
    } catch (error) {
        const errLog = `${new Date().toISOString()}\n${error.message}\n${error.stack}\n`;
        fs.writeFileSync(path.join(getOutputDir(), 'error.log'), errLog);
        console.error('❌ Conversion error:', error.message);
        res.status(500).json({ error: '변환 중 오류가 발생했습니다.', detail: error.message });
    }
});

/**
 * POST /api/fetch-slides
 * Fetch slide HTMLs from Genspark URLs (for preview).
 * Body: { urls: string[] }
 */
router.post('/fetch-slides', async (req, res) => {
    try {
        const { urls } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'urls 배열이 필요합니다.' });
        }

        if (urls.length > 100) {
            return res.status(400).json({ error: '최대 100장까지 가져올 수 있습니다.' });
        }

        console.log(`🌐 Fetching ${urls.length} slides from URLs...`);
        const result = await fetchSlideHtmls(urls, (current, total) => {
            console.log(`  📥 ${current}/${total}`);
        });

        res.json({
            slides: result.htmls,
            slideSize: result.slideSize,
            count: result.htmls.length,
        });
    } catch (error) {
        console.error('❌ Fetch error:', error);
        res.status(500).json({ error: '슬라이드 다운로드 중 오류가 발생했습니다.', detail: error.message });
    }
});

/**
 * GET /api/download/:filename
 */
router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(getOutputDir(), filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.pptx'
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : ext === '.pdf'
            ? 'application/pdf'
            : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
});

/**
 * POST /api/verify/:filename
 */
router.post('/verify/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const baseName = filename.replace(/\.(pptx|pdf)$/, '');
        const verifiedName = getVerifiedFilename(baseName);

        const files = [];
        for (const ext of ['pptx', 'pdf']) {
            const srcPath = getOutputPath(baseName, ext);
            const destPath = getOutputPath(verifiedName, ext);

            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                files.push({ ext, path: destPath, url: `/api/download/${verifiedName}.${ext}` });
                console.log(`✅ Verified: ${destPath}`);
            }
        }

        res.json({
            success: true,
            verifiedFilename: verifiedName,
            files,
        });
    } catch (error) {
        console.error('❌ Verify error:', error);
        res.status(500).json({ error: '검증 파일 생성 중 오류가 발생했습니다.', detail: error.message });
    }
});

export default router;
