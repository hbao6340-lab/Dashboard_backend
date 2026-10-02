// Async error forwarding for Express 4.
//
// Express 4 does not forward errors thrown inside async route handlers /
// middleware to the error-handling middleware — the rejected promise becomes
// an unhandled rejection and crashes the Node process. That means a single
// failed login (or any 401/404/validation error) would take the whole API
// down in production.
//
// This module patches Router (and app) HTTP-method functions once, wrapping
// every registered handler so rejected promises are passed to `next(err)`.
// Import it for its side effect BEFORE importing the app (see src/index.ts).
import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'

type AnyHandler = (req: Request, res: Response, next: NextFunction) => unknown

const WRAPPED = '__asyncErrorWrapped'
const PATCHED = '__asyncErrorPatched'

function wrapHandler(handler: unknown): unknown {
  if (typeof handler !== 'function' || (handler as any)[WRAPPED]) return handler
  // Error-handling middleware has 4 args — leave it alone.
  if ((handler as AnyHandler).length === 4) return handler
  const wrapped = function (this: unknown, req: Request, res: Response, next: NextFunction) {
    try {
      const result = (handler as AnyHandler).call(this, req, res, next)
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        ;(result as Promise<unknown>).catch(next)
      }
    } catch (err) {
      next(err)
    }
  }
  ;(wrapped as any)[WRAPPED] = true
  return wrapped
}

function patchTarget(target: any, methods: string[]) {
  for (const method of methods) {
    const original = target[method]
    if (typeof original !== 'function' || (original as any)[PATCHED]) continue
    const patched = function (this: unknown, ...args: unknown[]) {
      const wrappedArgs = args.map((a) => (Array.isArray(a) ? a.map(wrapHandler) : wrapHandler(a)))
      return original.apply(this, wrappedArgs)
    }
    ;(patched as any)[PATCHED] = true
    target[method] = patched
  }
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'all', 'use']

// Patch Router prototype (covers every Router() instance, including those
// created before this module loads since lookup is dynamic via prototype).
patchTarget(Object.getPrototypeOf(Router()), METHODS)

// Patch the app prototype as well (app.get/post/use/...).
// A throwaway app instance gives us the application prototype.
import express from 'express'
patchTarget(Object.getPrototypeOf(express()), METHODS)
