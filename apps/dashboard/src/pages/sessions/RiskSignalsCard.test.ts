import { describe, expect, it } from 'vitest'
import { matchedSessions } from './RiskSignalsCard'

describe('matchedSessions', () => {
  it('reads the identity/document detectors’ session ids', () => {
    expect(matchedSessions({ matched_session_ids: ['s-1', 's-2'] })).toEqual([{ id: 's-1' }, { id: 's-2' }])
  })

  it('reads face matches with their similarity', () => {
    expect(
      matchedSessions({ model: 'sface', matches: [{ session_id: 's-3', similarity: 0.91 }, { nope: true }] }),
    ).toEqual([{ id: 's-3', similarity: 0.91 }])
  })

  it('is empty for signals without matched sessions', () => {
    expect(matchedSessions({ ip: '1.2.3.4', sessions: 4 })).toEqual([])
  })
})
