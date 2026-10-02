// Report Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  getReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  submitReport,
  reviewReport,
  getReportReviews,
  uploadReportAttachment,
  getReportAttachments,
  downloadReportAttachment,
  upload,
} from '../controllers/report.controller.js'
import {
  getReportsSchema,
  getReportSchema,
  createReportSchema,
  updateReportSchema,
  submitReportSchema,
  reviewReportSchema,
} from '../validators/report.validators.js'
import { authMiddleware, requirePermission, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getReportsSchema), getReports)
router.get('/:id', validate(getReportSchema), getReport)
router.post('/', requirePermission('reports.create'), validate(createReportSchema), createReport)
router.patch('/:id', validate(updateReportSchema), updateReport)
router.delete('/:id', deleteReport)

router.post('/:id/submit', validate(submitReportSchema), submitReport)
router.post('/:id/review', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(reviewReportSchema), reviewReport)
router.get('/:id/reviews', getReportReviews)

// Report attachments (doc, docx, pdf, ...)
router.post('/:id/attachments', requirePermission('reports.create'), upload.single('file'), uploadReportAttachment)
router.get('/:id/attachments', getReportAttachments)
router.get('/:id/attachments/:attachmentId/download', downloadReportAttachment)

export default router