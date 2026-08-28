import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, loginWithGoogle } from './api'
import type { AuthUser } from './types'
import { getAccessToken, setAccessToken } from '../../shared/api/http'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  loginError: string | null
  signInWithGoogleIdToken: (idToken: string) => Promise<void>
  logout: () => void
  clearLoginError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const token = getAccessToken()
      if (!token) {
        if (!cancelled) {
          setStatus('anonymous')
        }
        return
      }

      try {
        const me = await fetchCurrentUser()
        if (!cancelled) {
          setUser(me)
          setStatus('authenticated')
        }
      } catch {
        setAccessToken(null)
        if (!cancelled) {
          setUser(null)
          setStatus('anonymous')
        }
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const clearLoginError = useCallback(() => {
    setLoginError(null)
  }, [])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
    setLoginError(null)
  }, [])

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    setLoginError(null)
    try {
      const auth = await loginWithGoogle(idToken)
      setAccessToken(auth.accessToken)
      setUser(auth.user)
      setStatus('authenticated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setLoginError(message)
      setAccessToken(null)
      setUser(null)
      setStatus('anonymous')
      throw err
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      loginError,
      signInWithGoogleIdToken,
      logout,
      clearLoginError,
    }),
    [status, user, loginError, signInWithGoogleIdToken, logout, clearLoginError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
