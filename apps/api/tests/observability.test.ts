import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../src/support/observability'

describe('reportError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a handled error without exiting the process', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    reportError(new Error("ENOENT: no such file or directory, stat 'GeoLite2-Country.mmdb'"), {
      scope: 'network',
      sessionId: 'session-1',
    })

    // Exiting here killed the queue worker mid-job, so a session never got its decision.
    expect(exit).not.toHaveBeenCalled()
    expect(errors.mock.calls.flat().join(' ')).toContain('GeoLite2-Country.mmdb')
  })
})
