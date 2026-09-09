// Audit Logging Middleware
import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../config/prisma.js'
import { AuthenticatedRequest } from './auth.js'

interface AuditLogData {
  userId?: string
  action: string
  targetType: string
  targetId?: string
  metadata?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
}

export const createAuditLog = async (data: AuditLogData) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action as any,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Failed to create audit log:', error)
  }
}

// Middleware to automatically log certain actions
export const auditMiddleware = (
  action: string,
  targetType: string,
  getTargetId?: (req: Request) => string | undefined,
  getMetadata?: (req: Request, res: Response) => Prisma.InputJsonValue
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original send to capture response
    const originalSend = res.send
    let responseBody: unknown

    res.send = function (body?: unknown): Response {
      responseBody = body
      return originalSend.call(this, body)
    }

    // Continue to next middleware
    await next()

    // Log after response (for successful operations)
    if (res.statusCode < 400) {
      const targetId = getTargetId ? getTargetId(req) : undefined
      const metadata = getMetadata ? getMetadata(req, res) : undefined

      await createAuditLog({
        userId: req.user?.id,
        action,
        targetType,
        targetId,
        metadata,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      })
    }
  }
}

// Helper functions for common audit actions
export const audit = {
  login: (req: AuthenticatedRequest, success: boolean, metadata?: Record<string, unknown>) =>
    createAuditLog({
      userId: req.user?.id,
      action: success ? 'LOGIN' : 'FAILED_LOGIN',
      targetType: 'USER',
      targetId: req.user?.id,
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }),

  logout: (req: AuthenticatedRequest) =>
    createAuditLog({
      userId: req.user?.id,
      action: 'LOGOUT',
      targetType: 'SESSION',
      targetId: req.sessionId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }),

  userCreated: (actorId: string, targetId: string, metadata?: Record<string, unknown>, req?: Request) =>
    createAuditLog({
      userId: actorId,
      action: 'USER_CREATED',
      targetType: 'USER',
      targetId,
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  userModified: (actorId: string, targetId: string, changes: Record<string, unknown>, req?: Request) =>
    createAuditLog({
      userId: actorId,
      action: 'USER_MODIFIED',
      targetType: 'USER',
      targetId,
      metadata: { changes } as Prisma.InputJsonValue,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  passwordReset: (actorId: string, targetId: string, req?: Request) =>
    createAuditLog({
      userId: actorId,
      action: 'PASSWORD_RESET',
      targetType: 'USER',
      targetId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  roleChanged: (actorId: string, targetId: string, oldRole: string, newRole: string, req?: Request) =>
    createAuditLog({
      userId: actorId,
      action: 'ROLE_CHANGED',
      targetType: 'USER',
      targetId,
      metadata: { oldRole, newRole } as Prisma.InputJsonValue,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  documentUploaded: (userId: string, documentId: string, metadata?: Record<string, unknown>, req?: Request) =>
    createAuditLog({
      userId,
      action: 'DOCUMENT_UPLOADED',
      targetType: 'DOCUMENT',
      targetId: documentId,
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  documentDownloaded: (userId: string, documentId: string, req?: Request) =>
    createAuditLog({
      userId,
      action: 'DOCUMENT_DOWNLOADED',
      targetType: 'DOCUMENT',
      targetId: documentId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  taskCreated: (userId: string, taskId: string, metadata?: Record<string, unknown>, req?: Request) =>
    createAuditLog({
      userId,
      action: 'TASK_CREATED',
      targetType: 'TASK',
      targetId: taskId,
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),

  reportSubmitted: (userId: string, reportId: string, req?: Request) =>
    createAuditLog({
      userId,
      action: 'REPORT_SUBMITTED',
      targetType: 'REPORT',
      targetId: reportId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    }),
}