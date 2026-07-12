import { Router } from '@arkstack/driver-express'
import path from 'path'
import { ExpressDriver } from '@arkstack/driver-express'
import { Arkstack, ArkstackRouterContract, ArkstackRouteListOptions } from '@arkstack/contract'
import { type ErrorRequestHandler, type Express, type Handler } from 'express'
import { reportError } from 'src/support/observability'

/**
 * Report unexpected failures (5xx / unclassified) to the observability seam, then
 * hand the error to the driver's renderer. Deliberate 4xx (validation, auth,
 * ApiException) are expected control flow and are not reported.
 */
const reportUnexpectedErrors: ErrorRequestHandler = (err, req, _res, next) => {
  const status = Number((err as { statusCode?: number; status?: number })?.statusCode ?? 500)
  if (!Number.isFinite(status) || status >= 500) {
    reportError(err, { method: req.method, path: req.originalUrl })
  }
  next(err)
}

export default class Application extends Arkstack<Express, unknown, Handler> {
  /**
   * Creates an instance of the Application class, initializing
   * the Express driver with the provided options and creating an Express
   * application instance.
   *
   * @param app
   */
  constructor(app?: Express) {
    super()
    this.driver = new ExpressDriver({
      bindRouter: async (runtime) => {
        runtime.use(await Router.bind())
      },
    })

    this.app = app ?? this.driver.createApp()

    Application.app = this.app
    globalThis.app = () => this.app as never
  }

  /**
   * Gets the ArkstackRouterContract implementation for the Express framework.
   *
   * @returns
   */
  getRouter(): ArkstackRouterContract<Express, unknown> {
    return {
      bind: (_app: Express) => Router.bind(),
      list: (options: ArkstackRouteListOptions = {}) => Router.list(options),
    }
  }

  /**
   * Boots the application by mounting public assets, binding the
   * router, applying middleware, and starting the server.
   *
   * @param port    The numeric port to run the server on
   * @param defer   Set to true to skip server startup
   */
  public async boot(port: number, defer = false) {
    // Load public assets
    await this.driver.mountPublicAssets(this.app, path.join(Arkstack.rootDir(), 'public'))

    // Apply all middleware
    await this.driver.applyMiddleware(this.app, config('middleware') as any)

    // Bind the router
    await this.driver.bindRouter(this.app)

    // Observability: report unexpected errors before the driver renders them.
    ;(this.app as Express).use(reportUnexpectedErrors)

    // Error Handler
    await this.driver.registerErrorHandler?.(this.app)

    // Start the server
    if (defer !== true) {
      await this.driver.start(this.app, port)
    }
  }
}
