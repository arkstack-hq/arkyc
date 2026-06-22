import { formdata, requestLogger, resora } from '@arkstack/driver-express/middlewares'

import { MiddlewareConfig } from '@arkstack/driver-express/types'
import cors from 'cors'
import corsConfig from './cors'
import express from 'express'
import { requestId } from '@app/http/middlewares'
import { useExpressUploadContext } from '@kanun-hq/plugin-file'

export default (): MiddlewareConfig => {
  const cConf = corsConfig()

  return {
    global: [
      // Parse application/json
      express.json({
        verify: (req, _res, buffer) => {
          req.rawBody = Buffer.from(buffer)
        },
      }),
      express.urlencoded({ extended: true }),
      (req, res, next) => {
        const bypass = req.headers.origin?.includes('192.168') || req.headers.origin?.includes('localhost')

        return cors({
          credentials: true,
          origin: cConf.allowed_origins.length > 0 && !bypass ? cConf.allowed_origins : true,
        })(req, res, next)
      },
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
