// Dashboard Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getDashboardStats } from '../controllers/dashboard.controller.js'
import { getDashboardStatsSchema } from '../validators/dashboard.validators.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/stats', validate(getDashboardStatsSchema), getDashboardStats)

export default router