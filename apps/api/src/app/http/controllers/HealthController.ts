import { BaseController } from '@controllers/BaseController'
import { DB } from 'arkormx'
import { HttpContext } from 'clear-router/types/express'
import { version } from '../../../../package.json'

type HealthScope = 'api' | 'web'

type HealthReport = {
  name: string
  scope: HealthScope
  status: 'online' | 'degraded'
  version: string
  timestamp: string
  checks: {
    database: {
      status: 'online' | 'offline'
      latencyMs: number
      message: string
    }
  }
}

export default class HealthController extends BaseController {
  private static getName(scope: HealthScope) {
    return `${env('APP_NAME', 'Arkyc')} ${scope === 'api' ? 'API' : 'Web'}`
  }

  private static async checkDatabase() {
    const startedAt = Date.now()

    try {
      await DB.raw('SELECT 1')

      return {
        status: 'online' as const,
        latencyMs: Date.now() - startedAt,
        message: 'Database connection is healthy',
      }
    } catch {
      return {
        status: 'offline' as const,
        latencyMs: Date.now() - startedAt,
        message: 'Database connection check failed',
      }
    }
  }

  private static async buildReport(scope: HealthScope): Promise<HealthReport> {
    const database = await this.checkDatabase()

    return {
      name: this.getName(scope),
      scope,
      status: database.status === 'online' ? 'online' : 'degraded',
      version,
      timestamp: new Date().toISOString(),
      checks: {
        database,
      },
    }
  }

  private static getHttpStatusCode(report: HealthReport) {
    return report.status === 'online' ? 200 : 503
  }

  private static renderPlainText(report: HealthReport) {
    return [
      `name=${report.name}`,
      `scope=${report.scope}`,
      `status=${report.status}`,
      `version=${report.version}`,
      `timestamp=${report.timestamp}`,
      `database.status=${report.checks.database.status}`,
      `database.latency_ms=${report.checks.database.latencyMs}`,
      `database.message=${report.checks.database.message}`,
    ].join('\n')
  }

  private static renderHtml(report: HealthReport) {
    const databaseStatusTone = report.checks.database.status === 'online' ? '#166534' : '#991b1b'
    const badgeBackground = report.checks.database.status === 'online' ? '#dcfce7' : '#fee2e2'
    const badgeBorder = report.checks.database.status === 'online' ? '#86efac' : '#fca5a5'

    return [
      '<!doctype html>',
      '<html lang="en" style="color-scheme: light; height: 100%;">',
      '<head>',
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  <title>${report.name} Health</title>`,
      '  <style>',
      '    :root { color-scheme: light; }',
      '    body { height: inherit; display: flex; flex-direction: row; align-items: center;}',
      '    * { box-sizing: border-box; }',
      '    body { margin: 0; font-family: Georgia, Cambria, "Times New Roman", serif; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #111827; }',
      '    .wrap { max-width: 880px; margin: 48px auto; padding: 0 20px; }',
      '    .card { background: rgba(255,255,255,.92); border: 1px solid rgba(148,163,184,.22); border-radius: 24px; padding: 28px; box-shadow: 0 20px 45px rgba(15,23,42,.08); backdrop-filter: blur(10px); }',
      '    h1 { margin: 0 0 10px; font-size: 2rem; line-height: 1.1; }',
      '    p { margin: 10px 0 0; line-height: 1.6; color: #334155; }',
      '    .badge { display: inline-block; margin-top: 14px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }',
      '    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 24px; }',
      '    .panel { border-radius: 18px; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; }',
      '    .label { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }',
      '    .value { margin: 0; font-size: 1rem; line-height: 1.5; color: #0f172a; }',
      '    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .95rem; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <main class="wrap">',
      '    <section class="card">',
      `      <h1>${report.name} health</h1>`,
      '      <p>This endpoint confirms service availability and runs a live database connectivity check before responding.</p>',
      `      <span class="badge" style="background: ${badgeBackground}; color: ${databaseStatusTone}; border: 1px solid ${badgeBorder};">${report.status}</span>`,
      '      <div class="grid">',
      '        <article class="panel">',
      '          <p class="label">Scope</p>',
      `          <p class="value">${report.scope}</p>`,
      '        </article>',
      '        <article class="panel">',
      '          <p class="label">Version</p>',
      `          <p class="value"><code>${report.version}</code></p>`,
      '        </article>',
      '        <article class="panel">',
      '          <p class="label">Checked At</p>',
      `          <p class="value"><code>${report.timestamp}</code></p>`,
      '        </article>',
      '        <article class="panel">',
      '          <p class="label">Database</p>',
      `          <p class="value">${report.checks.database.message}</p>`,
      `          <p class="value"><code>Status: ${report.checks.database.status} | Latency: ${report.checks.database.latencyMs} ms</code></p>`,
      '        </article>',
      '      </div>',
      '    </section>',
      '  </main>',
      '</body>',
      '</html>',
    ].join('\n')
  }

  async api({ res }: HttpContext) {
    const report = await HealthController.buildReport('api')

    return res.status(HealthController.getHttpStatusCode(report)).json(report)
  }

  async web({ req, res }: HttpContext) {
    const report = await HealthController.buildReport('web')
    const statusCode = HealthController.getHttpStatusCode(report)
    const wantsHumanResponse = typeof req.query.human !== 'undefined'

    if (wantsHumanResponse) {
      return res
        .status(statusCode)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(HealthController.renderHtml(report))
    }

    return res
      .status(statusCode)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .send(HealthController.renderPlainText(report))
  }
}
