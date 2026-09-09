// Validation Middleware
import { Request, Response, NextFunction } from 'express'
import { AnyZodObject, ZodError } from 'zod'
import { ValidationError } from './errorHandler.js'

export const validate = (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Validation failed', error.flatten().fieldErrors))
      } else {
        next(error)
      }
    }
  }