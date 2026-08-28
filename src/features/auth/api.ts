import { apiFetch, parseError } from '../../shared/api/http'
import type { AuthResponse, AuthUser } from './types'

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiFetch('/api/auth/google', {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const message = await parseError(response)
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return response.json() as Promise<AuthResponse>
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/me')
  if (!response.ok) {
    const message = await parseError(response)
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.json() as Promise<AuthUser>
}
