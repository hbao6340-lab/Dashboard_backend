// Audit Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getAuditLogsSchema } from '../validators/audit.validators.js'

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, message: 'Only administrators can view audit logs' })
  }

  const { page = 1, limit = 50, userId, action, targetType, targetId, startDate, endDate } = req.query

  const where: any = {}
  if (userId) where.userId = userId
  if (action) where.action = action
  if (targetType) where.targetType = targetType
  if (targetId) where.targetId = targetId
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate as string)
    if (endDate) where.createdAt.lte = new Date(endDate as string)
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, username: true, fullName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  res.json({
    success: true,
    data: { logs, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } },
  })
}

export const getAuditLog = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, message: 'Only administrators can view audit logs' })
  }

  const { id } = req.params

  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true, fullName: true } } },
  })

  if (!log) return res.status(404).json({ success: false, message: 'Audit log not found' })

  res.json({ success: true, data: { log } })
}

export const getAuditStats = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, message: 'Only developers can view audit stats' })
  }

  const [totalLogs, logsByAction, logsByUser, recentLogs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } }, take: 20 }),
    prisma.auditLog.groupBy({ by: ['userId'], _count: { userId: true }, orderBy: { _count: { userId: 'desc' } }, take: 10 }),
    prisma.auditLog.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { username: true, fullName: true } } } }),
  ])

  res.json({ success: true, data: { totalLogs, logsByAction, logsByUser, recentLogs } })
}