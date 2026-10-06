// User Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { audit } from '../middleware/audit.js'
import { AppError, NotFoundError, AuthorizationError, ConflictError } from '../middleware/errorHandler.js'
import argon2 from 'argon2'

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, search, role, status, departmentId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

  const where: any = { deletedAt: null }

  if (search) {
    where.OR = [
      { username: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { fullName: { contains: search as string, mode: 'insensitive' } },
    ]
  }
  if (role) where.role = role
  if (status) where.status = status
  if (departmentId) where.departmentId = departmentId

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        departmentId: true,
        position: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        _count: { select: { tasksAssigned: true, documents: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  res.json({
    success: true,
    data: { users, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } },
  })
}

export const getUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      departmentId: true,
      position: true,
      phone: true,
      avatarUrl: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, username: true, fullName: true } },
      updatedBy: { select: { id: true, username: true, fullName: true } },
      _count: {
        select: {
          documents: true,
          documentAssignments: true,
          tasksCreated: true,
          tasksAssigned: true,
          reportsSubmitted: true,
        },
      },
    },
  })

  if (!user) throw new NotFoundError('User')

  res.json({ success: true, data: { user } })
}

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators and developers can create users')
  }

  const { username, email, password, fullName, role, departmentId, position, phone } = req.body

  // Administrators cannot create developer accounts
  if (req.user!.role === 'ADMINISTRATOR' && role === 'DEVELOPER') {
    throw new AuthorizationError('Only developers can create developer accounts')
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } })
  if (existing) throw new ConflictError('Username or email already exists')

  const passwordHash = await argon2.hash(password)

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      fullName,
      role: role || 'USER',
      departmentId,
      position,
      phone,
      createdById: req.user!.id,
    },
    select: { id: true, username: true, email: true, fullName: true, role: true, status: true, departmentId: true, position: true, phone: true },
  })

  await audit.userCreated(req.user!.id, user.id, { username: user.username, role: user.role }, req)

  res.status(201).json({ success: true, message: 'User created successfully', data: { user } })
}

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { fullName, email, role, departmentId, position, phone, status } = req.body

  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser) throw new NotFoundError('User')

  // Permission checks
  if (req.user!.role === 'ADMINISTRATOR') {
    if (targetUser.role === 'DEVELOPER') throw new AuthorizationError('Cannot modify developer account')
    if (role && role === 'DEVELOPER') throw new AuthorizationError('Cannot assign developer role')
  }

  if (req.user!.role === 'USER') {
    // Regular users may only touch their own profile, and only safe fields.
    // (Without this, any user could escalate themselves to ADMINISTRATOR.)
    if (req.user!.id !== id) throw new AuthorizationError('You can only update your own profile')
    const allowedFields = ['fullName', 'phone', 'email']
    const requestedFields = Object.keys(req.body)
    const hasDisallowed = requestedFields.some(f => !allowedFields.includes(f))
    if (hasDisallowed) throw new AuthorizationError('You can only update your profile information')
  }

  // Check email uniqueness
  if (email && email !== targetUser.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictError('Email already in use')
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { fullName, email, role, departmentId, position, phone, status, updatedById: req.user!.id },
    select: { id: true, username: true, email: true, fullName: true, role: true, status: true, departmentId: true, position: true, phone: true },
  })

  await audit.userModified(req.user!.id, id, req.body, req)

  res.json({ success: true, message: 'User updated successfully', data: { user: updated } })
}

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'DEVELOPER') throw new AuthorizationError('Only developers can delete users')

  const { id } = req.params

  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser) throw new NotFoundError('User')
  if (targetUser.role === 'DEVELOPER') throw new AuthorizationError('Cannot delete developer account')
  if (targetUser.id === req.user!.id) throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE')

  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISABLED' } })
  await prisma.session.deleteMany({ where: { userId: id } })

  res.json({ success: true, message: 'User deleted successfully' })
}

export const resetUserPassword = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { newPassword } = req.body

  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can reset passwords')
  }

  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser) throw new NotFoundError('User')

  if (req.user!.role === 'ADMINISTRATOR' && targetUser.role === 'DEVELOPER') {
    throw new AuthorizationError('Cannot reset developer password')
  }

  const passwordHash = await argon2.hash(newPassword)

  await prisma.user.update({ where: { id }, data: { passwordHash } })
  await prisma.session.deleteMany({ where: { userId: id } })

  await audit.passwordReset(req.user!.id, id, req)

  res.json({ success: true, message: 'Password reset successfully' })
}

export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { status } = req.body // ACTIVE, INACTIVE, DISABLED

  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can change user status')
  }

  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser) throw new NotFoundError('User')

  if (req.user!.role === 'ADMINISTRATOR' && targetUser.role === 'DEVELOPER') {
    throw new AuthorizationError('Cannot modify developer account')
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status, updatedById: req.user!.id },
    select: { id: true, username: true, email: true, fullName: true, role: true, status: true },
  })

  // If disabling, revoke all sessions
  if (status === 'DISABLED') {
    await prisma.session.deleteMany({ where: { userId: id } })
  }

  await audit.userModified(req.user!.id, id, { status }, req)

  res.json({ success: true, message: 'User status updated successfully', data: { user: updated } })
}

export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  })

  res.json({ success: true, data: { departments } })
}