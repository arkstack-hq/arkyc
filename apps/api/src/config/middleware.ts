import { formdata, requestLogger, resora } from '@arkstack/driver-express/middlewares'

import { MiddlewareConfig } from '@arkstack/driver-express/types'
import cors from 'cors'
import express from 'express'
import { requestId } from '@app/http/middlewares'
import { useExpressUploadContext } from '@kanun-hq/plugin-file'

export default (): MiddlewareConfig => {
  return {
    global: [
      cors({ credentials: true, origin: true }),
      express.json({
        verify: (req, _res, buffer) => {
          req.rawBody = Buffer.from(buffer)
        },
      }),
      express.urlencoded({ extended: true }),
      formdata.any(),
    ],
    // requestLogger waits for the response itself; as an `after` middleware it
    // would call next() once the response finished and re-enter the router.
    before: [
      requestLogger(),
      resora(),
      requestId,
      (req, _, next) => {
        useExpressUploadContext(req as never)
        next()
      },
    ],
    after: [],
  }
}
