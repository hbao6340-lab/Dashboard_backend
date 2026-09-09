// Category Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js'
import { getCategoriesSchema, createCategorySchema, updateCategorySchema } from '../validators/category.validators.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getCategoriesSchema), getCategories)
router.get('/:id', validate(getCategoriesSchema), getCategory)

router.post('/', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(createCategorySchema), createCategory)
router.patch('/:id', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(updateCategorySchema), updateCategory)
router.delete('/:id', requireRole('DEVELOPER'), deleteCategory)

export default router