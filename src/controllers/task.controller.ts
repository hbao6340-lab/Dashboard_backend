// Task Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { audit } from '../middleware/audit.js'
import { AppError, NotFoundError, AuthorizationError } from '../middleware/errorHandler.js'

// Helper: Generate task number
async function generateTaskNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.task.count({
    where: { taskNumber: { startsWith: `TASK-${year}-` } },
  })
  return `TASK-${year}-${String(count + 1).padStart(6, '0')}`
}

// Helper: Check if user can access task
async function canAccessTask(userId: string, userRole: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignments: { where: { userId } } },
  })

  if (!task) return false
  if (['DEVELOPER', 'ADMINISTRATOR'].includes(userRole)) return true
  if (task.createdById === userId) return true
  if (task.assignments.length > 0) return true
  return false
}

// Helper: Update task status based on progress
type TaskStatus = 'NOT_STARTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'

function getStatusFromProgress(progress: number, currentStatus: TaskStatus): TaskStatus {
  if (progress === 100) return 'COMPLETED'
  if (progress > 0) return 'IN_PROGRESS'
  if (currentStatus === 'NOT_STARTED') return 'ASSIGNED'
  return currentStatus
}

// Helper: Create notification
async function createNotification(userId: string, type: any, title: string, message: string, relatedId: string, relatedType: string) {
  await prisma.notification.create({
    data: { userId, type, title, message, relatedId, relatedType },
  })
}

export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, search, categoryId, departmentId, status, priority, assignedToId, createdById, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

  const where: any = { deletedAt: null }

  // Role-based filtering
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    where.OR = [
      { createdById: req.user!.id },
      { assignments: { some: { userId: req.user!.id } } },
    ]
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { taskNumber: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ]
  }
  if (categoryId) where.categoryId = categoryId
  if (departmentId) where.departmentId = departmentId
  if (status) where.status = status
  if (priority) where.priority = priority
  if (assignedToId) where.assignments = { some: { userId: assignedToId } }
  if (createdById) where.createdById = createdById

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        category: { select: { id: true, name: true, color: true } },
        department: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        assignments: {
          include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
        },
        _count: { select: { progressUpdates: true, comments: true, attachments: true } },
      },
    }),
    prisma.task.count({ where }),
  ])

  res.json({
    success: true,
    data: {
      tasks,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    },
  })
}

export const getTask = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, username: true, fullName: true, email: true } },
      relatedDocument: { select: { id: true, documentNumber: true, title: true, status: true } },
      relatedReport: { select: { id: true, reportNumber: true, title: true, status: true } },
      assignments: {
        include: { user: { select: { id: true, username: true, fullName: true, email: true, department: { select: { name: true } } } } },
      },
      progressUpdates: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, username: true, fullName: true } } },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, username: true, fullName: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, username: true, fullName: true } } },
      },
      tags: { include: { tag: true } },
      dependencies: {
        include: { dependsOn: { select: { id: true, taskNumber: true, title: true, status: true } } },
      },
      dependents: {
        include: { task: { select: { id: true, taskNumber: true, title: true, status: true } } },
      },
    },
  })

  if (!task) throw new NotFoundError('Task')

  const hasAccess = await canAccessTask(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to view this task')

  res.json({ success: true, data: { task } })
}

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, categoryId, departmentId, relatedDocumentId, relatedReportId, startDate, deadline, priority, assigneeIds } = req.body

  const taskNumber = await generateTaskNumber()

  const task = await prisma.task.create({
    data: {
      taskNumber,
      title,
      description,
      categoryId,
      departmentId,
      relatedDocumentId,
      relatedReportId,
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      priority,
      createdById: req.user!.id,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, username: true, fullName: true } },
    },
  })

  // Create assignments
  if (assigneeIds && assigneeIds.length > 0) {
    for (const userId of assigneeIds) {
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          userId,
          assignedById: req.user!.id,
          isPrimary: assigneeIds.indexOf(userId) === 0,
        },
      })

      await createNotification(userId, 'TASK_ASSIGNED', 'Task Assigned', `You have been assigned to task: ${task.title}`, task.id, 'TASK')

      if (deadline) {
        await prisma.calendarEvent.create({
          data: {
            title: `Task Deadline: ${task.title}`,
            description: task.description,
            startAt: new Date(deadline),
            endAt: new Date(deadline),
            allDay: true,
            type: 'DEADLINE',
            relatedId: task.id,
            userId,
            color: '#EF4444',
          },
        })
      }
    }
  }

  // Audit log
  await audit.taskCreated(req.user!.id, task.id, { taskNumber, title, deadline, assigneeIds }, req)

  res.status(201).json({ success: true, message: 'Task created successfully', data: { task } })
}

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const data = req.body

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new NotFoundError('Task')

  // Check permissions
  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && task.createdById !== req.user!.id) {
    const assignment = await prisma.taskAssignment.findUnique({ where: { taskId_userId: { taskId: id, userId: req.user!.id } } })
    if (!assignment) throw new AuthorizationError('You do not have permission to update this task')
  }

  // Auto-update status from progress
  if (data.progress !== undefined) {
    data.status = getStatusFromProgress(data.progress, task.status)
    if (data.status === 'COMPLETED') data.completedAt = new Date()
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, color: true } },
      department: { select: { id: true, name: true } },
      assignments: { include: { user: { select: { id: true, username: true, fullName: true } } } },
    },
  })

  // Notify assignees of changes
  const assignments = await prisma.taskAssignment.findMany({ where: { taskId: id }, select: { userId: true } })
  for (const a of assignments) {
    if (a.userId !== req.user!.id) {
      await createNotification(a.userId, 'TASK_ASSIGNED', 'Task Updated', `Task "${task.title}" has been updated`, task.id, 'TASK')
    }
  }

  res.json({ success: true, message: 'Task updated successfully', data: { task: updated } })
}

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new NotFoundError('Task')

  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('Only administrators can delete tasks')
  }

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } })

  res.json({ success: true, message: 'Task cancelled successfully' })
}

export const assignTask = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { userId, isPrimary } = req.body

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new NotFoundError('Task')

  if (!['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role) && task.createdById !== req.user!.id) {
    throw new AuthorizationError('You do not have permission to assign this task')
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('User')

  const assignment = await prisma.taskAssignment.upsert({
    where: { taskId_userId: { taskId: id, userId } },
    create: { taskId: id, userId, assignedById: req.user!.id, isPrimary },
    update: { isPrimary, assignedById: req.user!.id },
    include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
  })

  await createNotification(userId, 'TASK_ASSIGNED', 'Task Assigned', `You have been assigned to task: ${task.title}`, task.id, 'TASK')

  if (task.deadline) {
    await prisma.calendarEvent.create({
      data: {
        title: `Task Deadline: ${task.title}`,
        description: task.description,
        startAt: task.deadline,
        endAt: task.deadline,
        allDay: true,
        type: 'DEADLINE',
        relatedId: task.id,
        userId,
        color: '#EF4444',
      },
    })
  }

  res.json({ success: true, message: 'Task assigned successfully', data: { assignment } })
}

export const updateTaskProgress = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { progress, updateText } = req.body

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new NotFoundError('Task')

  const assignment = await prisma.taskAssignment.findUnique({ where: { taskId_userId: { taskId: id, userId: req.user!.id } } })
  if (!assignment && !['DEVELOPER', 'ADMINISTRATOR'].includes(req.user!.role)) {
    throw new AuthorizationError('You are not assigned to this task')
  }

  const newStatus = getStatusFromProgress(progress, task.status)

  await prisma.$transaction(async (tx: any) => {
    // Create progress update
    await tx.taskProgress.create({
      data: { taskId: id, userId: req.user!.id, progress, updateText },
    })

    // Update task
    await tx.task.update({
      where: { id },
      data: { progress, status: newStatus, ...(newStatus === 'COMPLETED' && { completedAt: new Date() }) },
    })

    // Update assignment
    if (assignment) {
      await tx.taskAssignment.update({
        where: { id: assignment.id },
        data: { startedAt: assignment.startedAt || new Date(), ...(newStatus === 'COMPLETED' && { completedAt: new Date() }) },
      })
    }
  })

  // Notify creator and other assignees
  const assignments = await prisma.taskAssignment.findMany({ where: { taskId: id }, select: { userId: true } })
  for (const a of assignments) {
    if (a.userId !== req.user!.id) {
      await createNotification(a.userId, 'TASK_COMPLETED', 'Task Progress Updated', `${req.user!.fullName} updated progress on "${task.title}" to ${progress}%`, task.id, 'TASK')
    }
  }
  if (task.createdById !== req.user!.id) {
    await createNotification(task.createdById, 'TASK_COMPLETED', 'Task Progress Updated', `${req.user!.fullName} updated progress on "${task.title}" to ${progress}%`, task.id, 'TASK')
  }

  // Audit log
  await createAuditLog({
    userId: req.user!.id,
    action: 'TASK_PROGRESS_UPDATED',
    targetType: 'TASK',
    targetId: id,
    metadata: { progress, updateText, newStatus },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.json({ success: true, message: 'Progress updated successfully' })
}

export const addTaskComment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { content } = req.body

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw new NotFoundError('Task')

  const hasAccess = await canAccessTask(req.user!.id, req.user!.role, id)
  if (!hasAccess) throw new AuthorizationError('You do not have permission to comment on this task')

  const comment = await prisma.taskComment.create({
    data: { taskId: id, userId: req.user!.id, content },
    include: { user: { select: { id: true, username: true, fullName: true } } },
  })

  // Notify others
  const assignments = await prisma.taskAssignment.findMany({ where: { taskId: id }, select: { userId: true } })
  for (const a of assignments) {
    if (a.userId !== req.user!.id) {
      await createNotification(a.userId, 'TASK_ASSIGNED', 'New Comment', `${req.user!.fullName} commented on "${task.title}"`, task.id, 'TASK')
    }
  }

  res.status(201).json({ success: true, message: 'Comment added successfully', data: { comment } })
}

export const addTaskDependency = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { dependsOnId, type } = req.body

  if (id === dependsOnId) throw new AppError('A task cannot depend on itself', 400, 'INVALID_DEPENDENCY')

  const [task, dependsOn] = await Promise.all([
    prisma.task.findUnique({ where: { id } }),
    prisma.task.findUnique({ where: { id: dependsOnId } }),
  ])

  if (!task || !dependsOn) throw new NotFoundError('Task')

  const dependency = await prisma.taskDependency.create({
    data: { taskId: id, dependsOnId, type },
  })

  res.status(201).json({ success: true, message: 'Dependency added successfully', data: { dependency } })
}

export const removeTaskDependency = async (req: AuthenticatedRequest, res: Response) => {
  const { id, dependencyId } = req.params

  await prisma.taskDependency.delete({ where: { id: dependencyId } })

  res.json({ success: true, message: 'Dependency removed successfully' })
}

async function createAuditLog(data: any) {
  try {
    await prisma.auditLog.create({ data })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}