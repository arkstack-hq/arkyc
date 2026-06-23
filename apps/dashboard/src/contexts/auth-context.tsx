import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequest } from 'alova/client'
import type { User } from '@arkyc/types'
import { Auth, clearAuthToken, hasAuthToken } from '@/lib/api'
import { setUnauthorizedHandler } from '@/lib/requests/auth-session'

/** Routes that are reachable while unauthenticated (no 401 redirect from here). */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify']

interface AuthState {
  user: User | null
  loading: boolean
  /** Adopt a user after a successful login/register (the token is already persisted). */
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  // `data` is alova's reactive current-user state; restore it from a persisted
  // token on mount and drive it directly (no mirroring into local state). We only
  // hit `/auth/me` when a token is actually present, never while logged out.
  const {
    data: user,
    loading,
    update,
  } = useRequest(Auth.me(), {
    immediate: hasAuthToken(),
  })

  const { send: sendLogout } = useRequest(Auth.logout(), { immediate: false })

  const setUser = useCallback((next: User | null) => update({ data: next ?? undefined }), [update])

  const logout = useCallback(async () => {
    try {
      await sendLogout()
    } catch {
      // Best-effort; clear local state regardless.
    }
    await clearAuthToken()
    update({ data: undefined })
  }, [sendLogout, update])

  // Centralised 401 handling: an expired session drops the stale token + user and
  // sends the user to /login via the router (SPA navigation, no full reload),
  // unless they're already on a public route.
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearAuthToken()
      update({ data: undefined })
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        navigate('/login', { replace: true })
      }
    })
    return () => setUnauthorizedHandler(undefined)
  }, [update, navigate])

  const value = useMemo<AuthState>(
    () => ({ user: user ?? null, loading, setUser, logout }),
    [user, loading, setUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
