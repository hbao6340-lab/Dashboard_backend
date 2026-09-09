// Tag Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'

export const getTags = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 50, isActive } = req.query

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { documents: true, tasks: true, reports: true } },
      },
    }),
    prisma.tag.count({ where }),
  ])

  res.json({ success: true, data: { tags, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } } })
}

export const getTag = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) throw new NotFoundError('Tag')

  res.json({ success: true, data: { tag } })
}

export const createTag = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can create tags')
  }

  const { name, description, color } = req.body

  const existing = await prisma.tag.findUnique({ where: { name } })
  if (existing) throw new AppError('Tag with this name already exists', 409, 'DUPLICATE_NAME')

  const tag = await prisma.tag.create({ data: { name, description, color } })

  res.status(201).json({ success: true, message: 'Tag created successfully', data: { tag } })
}

export const updateTag = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can update tags')
  }

  const { id } = req.params
  const data = req.body

  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) throw new NotFoundError('Tag')

  const updated = await prisma.tag.update({ where: { id }, data })

  res.json({ success: true, message: 'Tag updated successfully', data: { tag: updated } })
}

export const deleteTag = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only developers can delete tags')
  }

  const { id } = req.params

  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) throw new NotFoundError('Tag')

  await prisma.tag.delete({ where: { id } })

  res.json({ success: true, message: 'Tag deleted successfully' })
}