// Authentication Middleware
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import env from '../config/env.js'
import { AuthenticationError, AuthorizationError } from './errorHandler.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    username: string
    email: string
    fullName: string
    role: string
    status: string
  }
  sessionId?: string
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.accessToken

    if (!token) {
      throw new AuthenticationError('No authentication token provided')
    }

    // Verify access token
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string
      sessionId: string
      username: string
      email: string
      role: string
    }

    // Check session exists and is valid
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new AuthenticationError('Session expired or invalid')
    }

    if (session.user.status !== 'ACTIVE') {
      throw new AuthorizationError('Account is disabled')
    }

    // Attach user to request
    req.user = {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      status: session.user.status,
    }
    req.sessionId = session.id

    next()
  } catch (error) {
    next(error)
  }
}

// Role-based authorization middleware
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required')
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions for this action')
    }

    next()
  }
}

// Permission-based authorization middleware
export const requirePermission = (permission: string) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required')
    }

    // Check if user's role has the required permission
    const rolePermission = await prisma.rolePermission.findUnique({
      where: {
        role_permissionId: {
          role: req.user.role as any,
          permissionId: permission,
        },
      },
    })

    if (!rolePermission) {
      throw new AuthorizationError(`Permission required: ${permission}`)
    }

    next()
  }
}

// Optional auth - doesn't throw if no token
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.accessToken

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string
        sessionId: string
        username: string
        email: string
        role: string
      }

      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      })

      if (session && session.expiresAt > new Date() && session.user.status === 'ACTIVE') {
        req.user = {
          id: session.user.id,
          username: session.user.username,
          email: session.user.email,
          fullName: session.user.fullName,
          role: session.user.role,
          status: session.user.status,
        }
        req.sessionId = session.id
      }
    }
    next()
  } catch {
    // Ignore auth errors for optional auth
    next()
  }
}