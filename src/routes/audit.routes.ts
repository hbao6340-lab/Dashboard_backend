// Audit Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getAuditLogs, getAuditLog, getAuditStats } from '../controllers/audit.controller.js'
import { getAuditLogsSchema } from '../validators/audit.validators.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware, requireRole('ADMINISTRATOR', 'DEVELOPER'))

router.get('/', validate(getAuditLogsSchema), getAuditLogs)
router.get('/stats', requireRole('DEVELOPER'), getAuditStats)
router.get('/:id', getAuditLog)

export default router