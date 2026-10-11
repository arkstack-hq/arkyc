import request from 'parasito'
import { app } from '../../src/core/bootstrap'

/**
 * Claim a session's single-use launch (or handoff) token for a device token,
 * as the widget does before any other Client API call.
 *
 * @param launchToken
 * @param origin  Sent as the `Origin` header when given.
 * @returns
 */
export async function claimDeviceToken(launchToken: string, origin?: string): Promise<string> {
  let req = request(app).post('/api/v1/client/claim').set('X-Client-Token', launchToken)
  if (origin) req = req.set('Origin', origin)

  const res = await req.send({})
  if (res.status !== 201) throw new Error(`claim failed (${res.status}): ${JSON.stringify(res.body)}`)

  return res.body.data.token
}
