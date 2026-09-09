// Document Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  getDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  assignDocument,
  getDocumentAssignments,
  updateDocumentAssignment,
  createDocumentVersion,
  getDocumentVersions,
  downloadDocumentVersion,
} from '../controllers/document.controller.js'
import {
  getDocumentsSchema,
  getDocumentSchema,
  createDocumentSchema,
  updateDocumentSchema,
  assignDocumentSchema,
  createDocumentVersionSchema,
} from '../validators/document.validators.js'
import { authMiddleware, requirePermission } from '../middleware/auth.js'
import { upload } from '../controllers/document.controller.js'

const router = Router()

router.use(authMiddleware)

// Document CRUD
router.get('/', validate(getDocumentsSchema), getDocuments)
router.get('/:id', validate(getDocumentSchema), getDocument)
router.post('/', requirePermission('documents.upload'), upload.single('file'), validate(createDocumentSchema), uploadDocument)
router.patch('/:id', validate(updateDocumentSchema), updateDocument)
router.delete('/:id', requirePermission('documents.delete'), deleteDocument)
router.get('/:id/download', requirePermission('documents.download'), downloadDocument)

// Document Assignments
router.get('/:id/assignments', getDocumentAssignments)
router.post('/:id/assign', requirePermission('documents.assign'), validate(assignDocumentSchema), assignDocument)
router.patch('/:id/assignments/:assignmentId', updateDocumentAssignment)

// Document Versions
router.get('/:id/versions', getDocumentVersions)
router.post('/:id/versions', requirePermission('documents.version'), upload.single('file'), validate(createDocumentVersionSchema), createDocumentVersion)
router.get('/:id/versions/:versionId/download', requirePermission('documents.download'), downloadDocumentVersion)

export default router