// Notification Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError, NotFoundError } from '../middleware/errorHandler.js'

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, isRead, type } = req.query

  const where: any = { userId: req.user!.id }
  if (isRead !== undefined) where.isRead = isRead
  if (type) where.type = type

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
  ])

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    },
  })
}

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw new NotFoundError('Notification')

  if (notification.userId !== req.user!.id) throw new AppError('Not authorized', 403, 'NOT_AUTHORIZED')

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })

  res.json({ success: true, message: 'Notification marked as read', data: { notification: updated } })
}

export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  res.json({ success: true, message: 'All notifications marked as read' })
}

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw new NotFoundError('Notification')

  if (notification.userId !== req.user!.id) throw new AppError('Not authorized', 403, 'NOT_AUTHORIZED')

  await prisma.notification.delete({ where: { id } })

  res.json({ success: true, message: 'Notification deleted successfully' })
}