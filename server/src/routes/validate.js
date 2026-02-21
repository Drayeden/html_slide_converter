import { Router } from 'express';
import { validateSlides } from '../services/validator.js';

const router = Router();

/**
 * POST /api/validate
 * Validate slides against quality criteria.
 * Body: { slides: string[] }
 */
router.post('/validate', async (req, res) => {
    try {
        const { slides } = req.body;

        if (!slides || !Array.isArray(slides) || slides.length === 0) {
            return res.status(400).json({ error: 'slides 배열이 필요합니다.' });
        }

        if (slides.length > 100) {
            return res.status(400).json({ error: '최대 100장까지 검증 가능합니다.' });
        }

        console.log(`🔍 Validating ${slides.length} slides...`);
        const results = await validateSlides(slides);
        console.log(`✅ Validation complete`);

        res.json({ results });
    } catch (error) {
        console.error('❌ Validation error:', error);
        res.status(500).json({ error: '검증 중 오류가 발생했습니다.', detail: error.message });
    }
});

export default router;
