import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

/** Attaches a correlation id to every request and echoes it in the response. */
export class RequestIdMiddleware {
    handler (req: Request, res: Response, next: NextFunction): void {
        const incoming = req.headers['x-request-id']
        const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID()
        req.requestId = id
        res.setHeader('X-Request-Id', id)
        next()
    }
}

export const requestId = (req: Request, res: Response, next: NextFunction): void =>
    new RequestIdMiddleware().handler(req, res, next)
