// Notification Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../controllers/notification.controller.js'
import { getNotificationsSchema, markNotificationReadSchema, markAllNotificationsReadSchema } from '../validators/notification.validators.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getNotificationsSchema), getNotifications)
router.patch('/:id/read', validate(markNotificationReadSchema), markNotificationRead)
router.post('/read-all', validate(markAllNotificationsReadSchema), markAllNotificationsRead)
router.delete('/:id', validate(markNotificationReadSchema), deleteNotification)

export default router