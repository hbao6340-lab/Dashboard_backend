// Calendar Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'

export const getCalendarEvents = async (req: AuthenticatedRequest, res: Response) => {
  const { start, end, type, userId } = req.query as { start?: string; end?: string; type?: string; userId?: string }
  const isPrivileged = ['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)

  const where: any = {}
  // Regular users only see their own events; admins/developers see all
  // (optionally filtered by userId) so document deadlines assigned to users
  // are visible on the admin calendar as well.
  if (!isPrivileged) {
    where.userId = req.user!.id
  } else if (userId) {
    where.userId = userId
  }
  if (start || end) {
    where.startAt = {}
    if (start) where.startAt.gte = new Date(start)
    if (end) where.startAt.lte = new Date(end)
  }
  if (end && !start) {
    where.endAt = { lte: new Date(end) }
  }
  if (type) where.type = type

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startAt: 'asc' },
    include: { user: { select: { id: true, username: true, fullName: true } } },
  })

  res.json({ success: true, data: { events } })
}

export const getCalendarEvent = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event) throw new NotFoundError('Calendar event')

  if (event.userId !== req.user!.id && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('You do not have permission to view this event')
  }

  res.json({ success: true, data: { event } })
}

export const createCalendarEvent = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, startAt, endAt, allDay, type, relatedId, color } = req.body

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      allDay,
      type,
      relatedId,
      userId: req.user!.id,
      color,
    },
  })

  res.status(201).json({ success: true, message: 'Calendar event created successfully', data: { event } })
}

export const updateCalendarEvent = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const data = req.body

  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event) throw new NotFoundError('Calendar event')

  if (event.userId !== req.user!.id && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('You do not have permission to update this event')
  }

  const updateData: any = { ...data }
  if (data.startAt) updateData.startAt = new Date(data.startAt)
  if (data.endAt) updateData.endAt = new Date(data.endAt)

  const updated = await prisma.calendarEvent.update({ where: { id }, data: updateData })

  res.json({ success: true, message: 'Calendar event updated successfully', data: { event: updated } })
}

export const deleteCalendarEvent = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event) throw new NotFoundError('Calendar event')

  if (event.userId !== req.user!.id && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('You do not have permission to delete this event')
  }

  await prisma.calendarEvent.delete({ where: { id } })

  res.json({ success: true, message: 'Calendar event deleted successfully' })
}