// Auth Controller
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import prisma from '../config/prisma.js'
import env from '../config/env.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { audit } from '../middleware/audit.js'
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
} from '../middleware/errorHandler.js'
import { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema, refreshTokenSchema } from '../validators/auth.validators.js'

// Generate access and refresh tokens
const generateTokens = (user: { id: string; username: string; email: string; role: string }, sessionId: string) => {
  const accessToken = jwt.sign(
    { userId: user.id, sessionId, username: user.username, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  )

  const refreshToken = jwt.sign(
    { userId: user.id, sessionId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  )

  return { accessToken, refreshToken }
}

// Set auth cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string, rememberMe: boolean) => {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : env.SESSION_MAX_AGE // 30 days or session max age

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  })

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  })
}

// Clear auth cookies
const clearAuthCookies = (res: Response) => {
  res.clearCookie('accessToken', { path: '/' })
  res.clearCookie('refreshToken', { path: '/' })
}

export const login = async (req: Request, res: Response) => {
  const { username, password, rememberMe } = loginSchema.shape.body.parse(req.body)

  // Find user by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      status: 'ACTIVE',
    },
  })

  if (!user) {
    await audit.login(req as AuthenticatedRequest, false, { username })
    throw new AuthenticationError('Invalid credentials')
  }

  // Verify password
  const isValid = await argon2.verify(user.passwordHash, password)
  if (!isValid) {
    await audit.login(req as AuthenticatedRequest, false, { username, userId: user.id })
    throw new AuthenticationError('Invalid credentials')
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: jwt.sign({ sessionId: 'temp' }, env.SESSION_SECRET), // Temporary token
      expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : env.SESSION_MAX_AGE)),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  })

  // Generate tokens with session ID
  const { accessToken, refreshToken } = generateTokens(user, session.id)

  // Update session with real token
  await prisma.session.update({
    where: { id: session.id },
    data: { token: refreshToken },
  })

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken, rememberMe ?? false)

  // Audit log
  await audit.login(req as AuthenticatedRequest, true, { userId: user.id })

  // Return user info (without password)
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        position: user.position,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt,
      },
    },
  })
}

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionId) {
    await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {})
    await audit.logout(req)
  }

  clearAuthCookies(res)

  res.json({ success: true, message: 'Logged out successfully' })
}

export const register = async (req: AuthenticatedRequest, res: Response) => {
  // Only developers can create accounts
  if (req.user?.role !== 'DEVELOPER') {
    throw new AuthorizationError('Only developers can create accounts')
  }

  const data = registerSchema.shape.body.parse(req.body)

  // Check if username or email exists
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: data.username }, { email: data.email }] },
  })

  if (existing) {
    throw new ConflictError('Username or email already exists')
  }

  // Hash password
  const passwordHash = await argon2.hash(data.password)

  // Create user
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role || 'USER',
      departmentId: data.departmentId,
      position: data.position,
      phone: data.phone,
      createdById: req.user.id,
    },
  })

  // Audit log
  await audit.userCreated(req.user.id, user.id, { username: user.username, role: user.role }, req)

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        position: user.position,
        phone: user.phone,
        status: user.status,
      },
    },
  })
}

export const me = async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
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
      department: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND')
  }

  res.json({ success: true, data: { user } })
}

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.shape.body.parse(req.body)

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND')
  }

  // Verify current password
  const isValid = await argon2.verify(user.passwordHash, currentPassword)
  if (!isValid) {
    throw new AuthenticationError('Current password is incorrect')
  }

  // Hash new password
  const passwordHash = await argon2.hash(newPassword)

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  // Invalidate all other sessions
  await prisma.session.deleteMany({
    where: { userId: user.id, NOT: { id: req.sessionId } },
  })

  // Audit log
  await audit.passwordReset(req.user!.id, user.id, req)

  res.json({ success: true, message: 'Password changed successfully' })
}

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  // Only admins and developers can reset passwords
  if (!['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)) {
    throw new AuthorizationError('Insufficient permissions')
  }

  const { userId, newPassword } = resetPasswordSchema.shape.body.parse(req.body)

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    throw new AppError('User not found', 404, 'NOT_FOUND')
  }

  // Admins can only reset passwords for users in their scope (not developers)
  if (req.user!.role === 'ADMINISTRATOR' && targetUser.role === 'DEVELOPER') {
    throw new AuthorizationError('Cannot reset developer password')
  }

  const passwordHash = await argon2.hash(newPassword)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  // Invalidate all sessions
  await prisma.session.deleteMany({ where: { userId } })

  // Audit log
  await audit.passwordReset(req.user!.id, userId, req)

  res.json({ success: true, message: 'Password reset successfully' })
}

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.shape.body.parse(req.body)

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string
      sessionId: string
      type: string
    }

    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type')
    }

    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new AuthenticationError('Session expired or invalid')
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      { id: session.user.id, username: session.user.username, email: session.user.email, role: session.user.role },
      session.id
    )

    // Update session with new refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: { token: newRefreshToken },
    })

    setAuthCookies(res, accessToken, newRefreshToken, true)

    res.json({ success: true, message: 'Token refreshed' })
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token')
    }
    throw error
  }
}