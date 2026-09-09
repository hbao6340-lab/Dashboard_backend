// Tag Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getTags, getTag, createTag, updateTag, deleteTag } from '../controllers/tag.controller.js'
import { getTagsSchema, createTagSchema, updateTagSchema } from '../validators/tag.validators.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getTagsSchema), getTags)
router.get('/:id', validate(getTagsSchema), getTag)
router.post('/', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(createTagSchema), createTag)
router.patch('/:id', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(updateTagSchema), updateTag)
router.delete('/:id', requireRole('DEVELOPER'), deleteTag)

export default router