// Settings Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'

export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  const { category, isPublic } = req.query

  const where: any = {}
  if (category) where.category = category
  if (isPublic !== undefined) where.isPublic = isPublic === 'true'

  // Non-admin users only see public settings
  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    where.isPublic = true
  }

  const settings = await prisma.systemSetting.findMany({
    where,
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  })

  // Group by category
  const grouped = settings.reduce((acc: Record<string, any[]>, setting: { category: string; [key: string]: any }) => {
    if (!acc[setting.category]) acc[setting.category] = []
    acc[setting.category].push(setting)
    return acc
  }, {} as Record<string, any[]>)

  res.json({ success: true, data: { settings: grouped } })
}

export const getSetting = async (req: AuthenticatedRequest, res: Response) => {
  const { key } = req.params

  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  if (!setting) throw new NotFoundError('Setting')

  if (!setting.isPublic && !['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Not authorized to view this setting')
  }

  res.json({ success: true, data: { setting } })
}

export const updateSetting = async (req: AuthenticatedRequest, res: Response) => {
  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can update settings')
  }

  const { key } = req.params
  const { value, description, category, isPublic } = req.body

  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, description, category: category || 'GENERAL', isPublic: isPublic || false, updatedById: req.user!.id },
    update: { value, description, category, isPublic, updatedById: req.user!.id },
  })

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'SETTINGS_MODIFIED',
      targetType: 'SETTING',
      targetId: setting.id,
      metadata: { key, value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  })

  res.json({ success: true, message: 'Setting updated successfully', data: { setting } })
}

export const getPublicSettings = async (req: Request, res: Response) => {
  const settings = await prisma.systemSetting.findMany({
    where: { isPublic: true },
    select: { key: true, value: true, description: true, category: true },
  })

  const grouped = settings.reduce((acc: Record<string, Record<string, any>>, setting: { category: string; key: string; value: any }) => {
    if (!acc[setting.category]) acc[setting.category] = {}
    acc[setting.category][setting.key] = setting.value
    return acc
  }, {} as Record<string, Record<string, any>>)

  res.json({ success: true, data: { settings: grouped } })
}