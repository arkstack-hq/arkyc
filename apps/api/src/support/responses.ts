import type { Response } from 'express'

/** Standard success envelope: `{ status, message, data }`. */
export function success<T> (res: Response, data: T, message = 'OK', code = 200): Response {
    return res.status(code).json({ status: 'success', message, data })
}

/** Standard error envelope: `{ status, message, errors? }`. */
export function failure (
    res: Response,
    code: number,
    message: string,
    errors?: Record<string, unknown>,
): Response {
    return res.status(code).json({
        status: 'error',
        message,
        ...(errors ? { errors } : {}),
    })
}
