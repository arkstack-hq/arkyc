import { formdata, requestLogger, resora } from '@arkstack/driver-express/middlewares'

import { MiddlewareConfig } from '@arkstack/driver-express/types'
import appConfig from './app'
import cors from 'cors'
import corsConfig from './cors'
import express from 'express'
import { requestId } from '@app/http/middlewares'
import { useExpressUploadContext } from '@kanun-hq/plugin-file'

export default (): MiddlewareConfig => {
  const cConf = corsConfig()
  const aConf = appConfig()

  return {
    global: [
      requestLogger(),
      (req, res, next) => {
        let hostname: string

        try {
          hostname = new URL(req.headers.origin ?? '').hostname
        } catch {
          hostname = req.headers.origin ?? ''
        }

        const bypass =
          hostname.includes('192.168') ||
          hostname.includes('127.0.0.1') ||
          hostname.includes('localhost') ||
          hostname.endsWith('.test') ||
          hostname.endsWith(`.${aConf.tenant_domain}`)

        return cors({
          credentials: true,
          origin: cConf.allowed_origins.length > 0 && !bypass ? cConf.allowed_origins : true,
        })(req, res, next)
      },
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
      (req, _res, next) => {
        useExpressUploadContext(req as never)
        next()
      },
    ],
    after: [requestLogger()],
  }
}
