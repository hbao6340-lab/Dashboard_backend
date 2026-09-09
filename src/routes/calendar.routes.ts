// Calendar Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { getCalendarEvents, getCalendarEvent, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../controllers/calendar.controller.js'
import { getCalendarEventsSchema, createCalendarEventSchema, updateCalendarEventSchema } from '../validators/calendar.validators.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', validate(getCalendarEventsSchema), getCalendarEvents)
router.get('/:id', validate(getCalendarEventsSchema), getCalendarEvent)
router.post('/', validate(createCalendarEventSchema), createCalendarEvent)
router.patch('/:id', validate(updateCalendarEventSchema), updateCalendarEvent)
router.delete('/:id', deleteCalendarEvent)

export default router