// Task Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  updateTaskProgress,
  addTaskComment,
  addTaskDependency,
  removeTaskDependency,
} from '../controllers/task.controller.js'
import {
  getTasksSchema,
  getTaskSchema,
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  updateTaskProgressSchema,
  addTaskCommentSchema,
  addTaskDependencySchema,
} from '../validators/task.validators.js'
import { authMiddleware, requirePermission } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getTasksSchema), getTasks)
router.get('/:id', validate(getTaskSchema), getTask)
router.post('/', requirePermission('tasks.create'), validate(createTaskSchema), createTask)
router.patch('/:id', validate(updateTaskSchema), updateTask)
router.delete('/:id', requirePermission('tasks.create'), deleteTask)

router.post('/:id/assign', requirePermission('tasks.assign'), validate(assignTaskSchema), assignTask)
router.post('/:id/progress', requirePermission('tasks.progress'), validate(updateTaskProgressSchema), updateTaskProgress)
router.post('/:id/comments', validate(addTaskCommentSchema), addTaskComment)

router.post('/:id/dependencies', validate(addTaskDependencySchema), addTaskDependency)
router.delete('/:id/dependencies/:dependencyId', removeTaskDependency)

export default router