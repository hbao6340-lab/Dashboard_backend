// Category Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'

export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 50, isActive } = req.query

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { documents: true, tasks: true, reports: true } },
      },
    }),
    prisma.category.count({ where }),
  ])

  res.json({ success: true, data: { categories, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } } })
}

export const getCategory = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { documents: true, tasks: true, reports: true } },
    },
  })

  if (!category) throw new NotFoundError('Category')

  res.json({ success: true, data: { category } })
}

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can create categories')
  }

  const { name, description, color, icon, sortOrder } = req.body

  const existing = await prisma.category.findUnique({ where: { name } })
  if (existing) throw new AppError('Category with this name already exists', 409, 'DUPLICATE_NAME')

  const category = await prisma.category.create({
    data: { name, description, color, icon, sortOrder },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CATEGORY_CREATED',
      targetType: 'CATEGORY',
      targetId: category.id,
      metadata: { name, color },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  })

  res.status(201).json({ success: true, message: 'Category created successfully', data: { category } })
}

export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can update categories')
  }

  const { id } = req.params
  const data = req.body

  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) throw new NotFoundError('Category')

  const updated = await prisma.category.update({ where: { id }, data })

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CATEGORY_MODIFIED',
      targetType: 'CATEGORY',
      targetId: id,
      metadata: data,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  })

  res.json({ success: true, message: 'Category updated successfully', data: { category: updated } })
}

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only developers can delete categories')
  }

  const { id } = req.params

  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) throw new NotFoundError('Category')

  // Check if in use
  const [docCount, taskCount, reportCount] = await Promise.all([
    prisma.document.count({ where: { categoryId: id } }),
    prisma.task.count({ where: { categoryId: id } }),
    prisma.report.count({ where: { categoryId: id } }),
  ])

  if (docCount > 0 || taskCount > 0 || reportCount > 0) {
    throw new AppError('Cannot delete category that is in use', 400, 'CATEGORY_IN_USE')
  }

  await prisma.category.delete({ where: { id } })

  res.json({ success: true, message: 'Category deleted successfully' })
}