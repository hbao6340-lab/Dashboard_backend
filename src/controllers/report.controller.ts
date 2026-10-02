// Report Controller
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

// Multer config for report attachments (doc, docx, pdf, xls, xlsx, txt, jpg, png, zip)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = env.UPLOAD_DIR
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = env.ALLOWED_MIME_TYPES.split(',')
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError('File type not allowed. Allowed: doc, docx, pdf, xls, xlsx, txt, jpg, png, zip', 400, 'INVALID_FILE_TYPE'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
})

// Helper: Generate report number
async function generateReportNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.report.count({
    where: { reportNumber: { startsWith: `RPT-${year}-` } },
  })
  return `RPT-${year}-${String(count + 1).padStart(6, '0')}`
}

// Helper: Check if user can access report
async function canAccessReport(userId: string, userRole: string, reportId: string): Promise<boolean> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { reviews: { where: { reviewerId: userId } } },
  })

  if (!report) return false
  if (['DEVELOPER', 'ADMINISTRATOR'].includes(userRole)) return true
  if (report.authorId === userId) return true
  if (report.reviews.length > 0) return true
  return false
}

// Helper: Create notification
async function createNotification(userId: string, type: any, title: string, message: string, relatedId: string, relatedType: string) {
  await prisma.notification.create({
    data: { userId, type, title, message, relatedId, relatedType },
  })
}

export const getReports = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, search, type, categoryId, authorId, status, reportingMonth, reportingYear, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

  const where: any = { deletedAt: null }

  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    where.OR = [
      { authorId: req.user!.id },
      { reviews: { some: { reviewerId: req.user!.id } } },
    ]
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { reportNumber: { contains: search as string, mode: 'insensitive' } },
      { subject: { contains: search as string, mode: 'insensitive' } },
    ]
  }
  if (type) where.type = type
  if (categoryId) where.categoryId = categoryId
  if (authorId) where.authorId = authorId
  if (status) where.status = status
  if (reportingMonth) where.reportingMonth = Number(reportingMonth)
  if (reportingYear) where.reportingYear = Number(reportingYear)

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        category: { select: { id: true, name: true, color: true } },
        author: { select: { id: true, username: true, fullName: true } },
        relatedTask: { select: { id: true, taskNumber: true, title: true } },
        relatedDocument: { select: { id: true, documentNumber: true, title: true } },
        reviews: {
          include: { reviewer: { select: { id: true, username: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.report.count({ where }),
  ])

  res.json({
    success: true,
    data: { reports, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } },
  })
}

export const getReport = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      author: { select: { id: true, username: true, fullName: true, email: true, department: { select: { name: true } } } },
      relatedTask: { select: { id: true, taskNumber: true, title: true, status: true } },
      relatedDocument: { select: { id: true, documentNumber: true, title: true, status: true } },
      attachments: { orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: { id: true, username: true, fullName: true } } } },
      reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { id: true, username: true, fullName: true } } } },
      tags: { include: { tag: true } },
    },
  })

  if (!report) throw new NotFoundError('Report')

  const hasAccess = await canAccessReport(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to view this report')

  res.json({ success: true, data: { report } })
}

export const createReport = async (req: AuthenticatedRequest, res: Response) => {
  const { title, type, categoryId, subject, summary, content, workCompleted, results, problems, recommendations, statistics, reportingMonth, reportingYear, relatedTaskId, relatedDocumentId } = req.body

  const reportNumber = await generateReportNumber()

  const report = await prisma.report.create({
    data: {
      reportNumber,
      title,
      type,
      categoryId,
      authorId: req.user!.id,
      subject,
      summary,
      content,
      workCompleted,
      results,
      problems,
      recommendations,
      statistics,
      reportingMonth,
      reportingYear,
      relatedTaskId,
      relatedDocumentId,
      status: 'DRAFT',
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      author: { select: { id: true, username: true, fullName: true } },
      relatedTask: { select: { id: true, taskNumber: true, title: true } },
    },
  })

  res.status(201).json({ success: true, message: 'Report created successfully', data: { report } })
}

export const updateReport = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const data = req.body

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) throw new NotFoundError('Report')

  // Only author or admin can update
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && report.authorId !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to update this report')
  }

  // Cannot update if not in draft or revision requested
  if (!['DRAFT', 'REVISION_REQUESTED'].includes(report.status)) {
    throw new AppError('Cannot update report in current status', 400, 'INVALID_STATUS')
  }

  const updated = await prisma.report.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true, color: true } }, author: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, message: 'Report updated successfully', data: { report: updated } })
}

export const deleteReport = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) throw new NotFoundError('Report')

  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && report.authorId !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to delete this report')
  }

  await prisma.report.update({ where: { id }, data: { deletedAt: new Date() } })

  res.json({ success: true, message: 'Report deleted successfully' })
}

export const submitReport = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const report = await prisma.report.findUnique({ where: { id }, include: { author: { select: { fullName: true } } } })
  if (!report) throw new NotFoundError('Report')

  if (report.authorId !== req.user!.id && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only the author can submit this report')
  }

  if (report.status !== 'DRAFT' && report.status !== 'REVISION_REQUESTED') {
    throw new AppError('Only draft or revision requested reports can be submitted', 400, 'INVALID_STATUS')
  }

  const updated = await prisma.report.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: { author: { select: { id: true, username: true, fullName: true } } },
  })

  // Notify admins for review
  const admins = await prisma.user.findMany({ where: { role: { in: ['ADMINISTRATOR', 'DEVELOPER'] } }, select: { id: true } })
  for (const admin of admins) {
    await createNotification(admin.id, 'REPORT_SUBMITTED', 'Report Submitted for Review', `${report.author.fullName} submitted "${report.title}" for review`, report.id, 'REPORT')
  }

  // Audit log
  await audit.reportSubmitted(req.user!.id, id, req)

  res.json({ success: true, message: 'Report submitted for review', data: { report: updated } })
}

export const reviewReport = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { status, comments } = req.body

  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can review reports')
  }

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) throw new NotFoundError('Report')

  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(report.status)) {
    throw new AppError('Report must be submitted or under review', 400, 'INVALID_STATUS')
  }

  const review = await prisma.reportReview.create({
    data: { reportId: id, reviewerId: req.user!.id, status, comments },
    include: { reviewer: { select: { id: true, username: true, fullName: true } } },
  })

  let newStatus = status
  if (status === 'APPROVED') newStatus = 'FINALIZED'
  if (status === 'REVISION_REQUESTED') newStatus = 'REVISION_REQUESTED'

  const updated = await prisma.report.update({
    where: { id },
    data: { status: newStatus, ...(newStatus === 'FINALIZED' && { finalizedAt: new Date() }) },
  })

  // Notify author
  await createNotification(report.authorId, status === 'APPROVED' ? 'REPORT_APPROVED' : 'REVISION_REQUESTED', `Report ${status === 'APPROVED' ? 'Approved' : 'Revision Requested'}`, `Your report "${report.title}" has been ${status.toLowerCase().replace('_', ' ')}`, report.id, 'REPORT')

  // Audit log
  await createAuditLog({
    userId: req.user!.id,
    action: status === 'APPROVED' ? 'REPORT_APPROVED' : status === 'REJECTED' ? 'REPORT_REJECTED' : 'REPORT_REVISION_REQUESTED',
    targetType: 'REPORT',
    targetId: id,
    metadata: { status, comments },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.json({ success: true, message: `Report ${status.toLowerCase().replace('_', ' ')} successfully`, data: { report: updated, review } })
}

export const getReportReviews = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const reviews = await prisma.reportReview.findMany({
    where: { reportId: id },
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, data: { reviews } })
}

export const uploadReportAttachment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const file = req.file

  if (!file) throw new AppError('No file uploaded', 400, 'NO_FILE')

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) throw new NotFoundError('Report')

  const hasAccess = await canAccessReport(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to attach files to this report')

  const attachment = await prisma.reportAttachment.create({
    data: {
      reportId: id,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: file.filename,
      uploadedById: req.user!.id,
    },
    include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
  })

  res.status(201).json({ success: true, message: 'Tệp đính kèm đã được tải lên', data: { attachment } })
}

export const getReportAttachments = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const hasAccess = await canAccessReport(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to view this report')

  const attachments = await prisma.reportAttachment.findMany({
    where: { reportId: id },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, data: { attachments } })
}

export const downloadReportAttachment = async (req: AuthenticatedRequest, res: Response) => {
  const { id, attachmentId } = req.params

  const attachment = await prisma.reportAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment || attachment.reportId !== id) throw new NotFoundError('Attachment')

  const hasAccess = await canAccessReport(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to download this attachment')

  const filePath = path.join(env.UPLOAD_DIR, attachment.filePath)
  if (!fs.existsSync(filePath)) throw new NotFoundError('File')

  res.download(filePath, attachment.fileName)
}

async function createAuditLog(data: any) {
  try {
    await prisma.auditLog.create({ data })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}