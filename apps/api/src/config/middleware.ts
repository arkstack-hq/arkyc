import { formdata, requestLogger, resora } from '@arkstack/driver-express/middlewares'

import { MiddlewareConfig } from '@arkstack/driver-express/types'
import cors from 'cors'
import express from 'express'
import { requestId } from '@app/http/middlewares'
import { useExpressUploadContext } from '@kanun-hq/plugin-file'

export default (): MiddlewareConfig => {
  return {
    global: [
      // CORS runs FIRST, before the body parsers. If `express.json()` throws on a
      // malformed body it does so before any later middleware, so putting CORS
      // after it would leave that 400 without `Access-Control-Allow-Origin` and the
      // browser would surface a bogus CORS error instead of the real parse failure.
      // Allow any origin: the Client API is meant to be called cross-origin from
      // customer sites (token-gated, like a publishable key), so the embedded
      // widget works with zero config. Auth is header-based (Bearer /
      // X-Client-Token), not cookies, so reflecting the origin is safe.
      cors({ credentials: true, origin: true }),
      // Parse application/json
      express.json({
        verify: (req, _res, buffer) => {
          req.rawBody = Buffer.from(buffer)
        },
      }),
      express.urlencoded({ extended: true }),
      formdata.any(),
    ],
    before: [
      resora(),
      requestId,
      (req, _, next) => {
        useExpressUploadContext(req as never)
        next()
      },
    ],
    after: [requestLogger()],
  }
}
