import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@arkyc/types'
import { api, tokenStore } from './api'
import { queryClient } from './query'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    api.auth
      .me()
      .then((u) => active && setUser(u))
      .catch(() => {
        tokenStore.clear()
        if (active) setUser(null)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token } = await api.auth.login({ email, password })
    tokenStore.set(token)
    setUser(u)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: u, token } = await api.auth.register({ name, email, password })
    tokenStore.set(token)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      // Best-effort; clear local state regardless.
    }
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
