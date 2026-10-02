// Document Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { audit } from '../middleware/audit.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import env from '../config/env.js'

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = env.UPLOAD_DIR
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${uuidv4()}${ext}`
    cb(null, filename)
  },
})

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = env.ALLOWED_MIME_TYPES.split(',')
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError('File type not allowed', 400, 'INVALID_FILE_TYPE'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
})

// Helper: Check if user can access document
async function canAccessDocument(userId: string, userRole: string, documentId: string): Promise<boolean> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      assignments: { where: { userId } },
    },
  })

  if (!doc) return false

  // Developer and Admin can access all
  if (['DEVELOPER', 'ADMINISTRATOR'].includes(userRole)) return true

  // Uploader can access
  if (doc.uploadedById === userId) return true

  // Assigned user can access
  if (doc.assignments.length > 0) return true

  return false
}

// Helper: Generate document number
async function generateDocumentNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.document.count({
    where: {
      documentNumber: { startsWith: `DOC-${year}-` },
    },
  })
  return `DOC-${year}-${String(count + 1).padStart(6, '0')}`
}

export const getDocuments = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, search, categoryId, status, type, uploadedById, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

  const where: any = { deletedAt: null }

  // Role-based filtering
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    where.OR = [
      { uploadedById: req.user!.id },
      { assignments: { some: { userId: req.user!.id } } },
    ]
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { documentNumber: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ]
  }
  if (categoryId) where.categoryId = categoryId
  if (status) where.status = status
  if (type) where.type = type
  if (uploadedById) where.uploadedById = uploadedById

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        category: { select: { id: true, name: true, color: true } },
        uploadedBy: { select: { id: true, username: true, fullName: true } },
        assignments: {
          include: { user: { select: { id: true, username: true, fullName: true } } },
        },
        _count: { select: { versions: true } },
      },
    }),
    prisma.document.count({ where }),
  ])

  res.json({
    success: true,
    data: {
      documents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  })
}

export const getDocument = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      uploadedBy: { select: { id: true, username: true, fullName: true, email: true } },
      versions: {
        orderBy: { version: 'desc' },
        take: 10,
        include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
      },
      assignments: {
        include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
      },
      tags: { include: { tag: true } },
      relatedTask: { select: { id: true, taskNumber: true, title: true, status: true } },
      relatedReport: { select: { id: true, reportNumber: true, title: true, status: true } },
    },
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  // Check access
  const hasAccess = await canAccessDocument(req.user!.id, req.user!.role, id)
  if (!hasAccess) {
    throw new AuthorizationError('You do not have permission to view this document')
  }

  res.json({ success: true, data: { document } })
}

export const uploadDocument = async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file
  const { title, description, type, categoryId, confidentiality, relatedTaskId, relatedReportId } = req.body

  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE')
  }

  const documentNumber = await generateDocumentNumber()

  const document = await prisma.document.create({
    data: {
      documentNumber,
      title,
      description,
      type,
      categoryId,
      confidentiality: confidentiality || 'INTERNAL',
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: file.filename,
      originalName: file.originalname,
      uploadedById: req.user!.id,
      relatedTaskId,
      relatedReportId,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      uploadedBy: { select: { id: true, username: true, fullName: true } },
    },
  })

  // Create initial version
  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: file.filename,
      originalName: file.originalname,
      changeNotes: 'Initial version',
      uploadedById: req.user!.id,
    },
  })

  // Audit log
  await audit.documentUploaded(req.user!.id, document.id, {
    documentNumber,
    fileName: file.originalname,
    fileSize: file.size,
  }, req)

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: { document },
  })
}

export const updateDocument = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const data = req.body

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) {
    throw new NotFoundError('Document')
  }

  // Check permissions
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && document.uploadedById !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to update this document')
  }

  const updated = await prisma.document.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, color: true } },
      uploadedBy: { select: { id: true, username: true, fullName: true } },
    },
  })

  // Audit log
  await audit.userModified(req.user!.id, id, data, req)

  res.json({ success: true, message: 'Document updated successfully', data: { document: updated } })
}

export const deleteDocument = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) {
    throw new NotFoundError('Document')
  }

  // Only developer/admin can delete
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can delete documents')
  }

  await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  })

  // Archive assignments
  await prisma.documentAssignment.updateMany({
    where: { documentId: id },
    data: { status: 'COMPLETED' },
  })

  // Audit log
  await createAuditLog({
    userId: req.user!.id,
    action: 'DOCUMENT_ARCHIVED',
    targetType: 'DOCUMENT',
    targetId: id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.json({ success: true, message: 'Document archived successfully' })
}

export const downloadDocument = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) {
    throw new NotFoundError('Document')
  }

  // Check access
  const hasAccess = await canAccessDocument(req.user!.id, req.user!.role, id)
  if (!hasAccess) {
    throw new AuthorizationError('You do not have permission to download this document')
  }

  const filePath = path.join(env.UPLOAD_DIR, document.filePath)

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File')
  }

  // Audit log
  await audit.documentDownloaded(req.user!.id, id, req)

  res.download(filePath, document.originalName)
}

export const assignDocument = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { userId, responsibility, instructions, deadline, priority, notes } = req.body

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) {
    throw new NotFoundError('Document')
  }

  // Check permissions
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && document.uploadedById !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to assign this document')
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new NotFoundError('User')
  }

  const assignment = await prisma.documentAssignment.upsert({
    where: { documentId_userId: { documentId: id, userId } },
    create: {
      documentId: id,
      userId,
      responsibility,
      instructions,
      deadline: deadline ? new Date(deadline) : null,
      priority,
      notes,
      assignedById: req.user!.id,
    },
    update: {
      responsibility,
      instructions,
      deadline: deadline ? new Date(deadline) : null,
      priority,
      notes,
      assignedById: req.user!.id,
      status: 'ASSIGNED',
    },
    include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
  })

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'DOCUMENT_ASSIGNED',
      title: 'Document Assigned',
      message: `You have been assigned to document: ${document.title}`,
      relatedId: id,
      relatedType: 'DOCUMENT',
    },
  })

  // Create calendar event if deadline
  if (deadline) {
    const deadlineDate = new Date(deadline)
    // Event on the assignee's calendar
    await prisma.calendarEvent.create({
      data: {
        title: `Document Deadline: ${document.title}`,
        description: instructions || responsibility,
        startAt: deadlineDate,
        endAt: deadlineDate,
        allDay: true,
        type: 'DEADLINE',
        relatedId: id,
        userId,
        color: '#EF4444',
      },
    })
    // Mirror event on the assigner's (admin) calendar so both sides see it
    if (req.user!.id !== userId) {
      await prisma.calendarEvent.create({
        data: {
          title: `Đã giao: ${document.title} → ${user.fullName || user.username}`,
          description: instructions || responsibility,
          startAt: deadlineDate,
          endAt: deadlineDate,
          allDay: true,
          type: 'DEADLINE',
          relatedId: id,
          userId: req.user!.id,
          color: '#F59E0B',
        },
      })
    }
  }

  // Audit log
  await createAuditLog({
    userId: req.user!.id,
    action: 'TASK_ASSIGNED',
    targetType: 'DOCUMENT',
    targetId: id,
    metadata: { userId, responsibility, deadline },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.json({ success: true, message: 'Document assigned successfully', data: { assignment } })
}

export const getDocumentAssignments = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const assignments = await prisma.documentAssignment.findMany({
    where: { documentId: id },
    include: {
      user: { select: { id: true, username: true, fullName: true, email: true, department: { select: { name: true } } } },
      assignedBy: { select: { id: true, username: true, fullName: true } },
    },
  })

  res.json({ success: true, data: { assignments } })
}

export const updateDocumentAssignment = async (req: AuthenticatedRequest, res: Response) => {
  const { id, assignmentId } = req.params
  const { status, notes } = req.body

  const assignment = await prisma.documentAssignment.findUnique({ where: { id: assignmentId } })
  if (!assignment || assignment.documentId !== id) {
    throw new NotFoundError('Assignment')
  }

  // Only assignee or admin can update
  if (assignment.userId !== req.user!.id && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('You can only update your own assignments')
  }

  const updated = await prisma.documentAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      notes,
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
    },
    include: { user: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, message: 'Assignment updated successfully', data: { assignment: updated } })
}

export const createDocumentVersion = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const file = req.file
  const { changeNotes } = req.body

  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE')
  }

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) {
    throw new NotFoundError('Document')
  }

  // Check permissions
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && document.uploadedById !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to create versions')
  }

  const latestVersion = await prisma.documentVersion.findFirst({
    where: { documentId: id },
    orderBy: { version: 'desc' },
  })

  const newVersion = (latestVersion?.version || 0) + 1

  const version = await prisma.documentVersion.create({
    data: {
      documentId: id,
      version: newVersion,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: file.filename,
      originalName: file.originalname,
      changeNotes,
      uploadedById: req.user!.id,
    },
    include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
  })

  // Update document
  await prisma.document.update({
    where: { id },
    data: {
      version: newVersion,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: file.filename,
      originalName: file.originalname,
      updatedAt: new Date(),
    },
  })

  // Audit log
  await createAuditLog({
    userId: req.user!.id,
    action: 'DOCUMENT_VERSION_CREATED',
    targetType: 'DOCUMENT',
    targetId: id,
    metadata: { version: newVersion, changeNotes, fileName: file.originalname },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.status(201).json({ success: true, message: 'New version created successfully', data: { version } })
}

export const getDocumentVersions = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { version: 'desc' },
    include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, data: { versions } })
}

export const downloadDocumentVersion = async (req: AuthenticatedRequest, res: Response) => {
  const { id, versionId } = req.params

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  })

  if (!version || version.documentId !== id) {
    throw new NotFoundError('Version')
  }

  // Check access
  const hasAccess = await canAccessDocument(req.user!.id, req.user!.role, id)
  if (!hasAccess) {
    throw new AuthorizationError('You do not have permission to download this version')
  }

  const filePath = path.join(env.UPLOAD_DIR, version.filePath)
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File')
  }

  res.download(filePath, version.originalName)
}

// Helper function for audit logging
async function createAuditLog(data: any) {
  try {
    await prisma.auditLog.create({ data })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}