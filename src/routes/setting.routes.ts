// Settings Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getSettings, getSetting, updateSetting, getPublicSettings } from '../controllers/setting.controller.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// Public settings (no auth required)
router.get('/public', getPublicSettings)

router.use(authMiddleware)

router.get('/', validate(z.object({ query: z.object({ category: z.string().optional(), isPublic: z.string().optional() }) })), getSettings)
router.get('/:key', getSetting)
router.patch('/:key', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(z.object({ params: z.object({ key: z.string() }), body: z.object({ value: z.any(), description: z.string().optional(), category: z.string().optional(), isPublic: z.boolean().optional() }) })), updateSetting)

export default router