const API_URL = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'dietaapp.accessToken'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; title?: string }
    if (body.detail) {
      return body.detail
    }
    if (body.title) {
      return body.title
    }
  } catch {
    // ignore JSON parse errors
  }
  return `HTTP ${response.status}`
}

type ApiFetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
  auth?: boolean
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { auth = true, headers = {}, ...rest } = options
  const requestHeaders: Record<string, string> = { ...headers }

  if (auth) {
    const token = getAccessToken()
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
    }
  }

  return fetch(`${API_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
  })
}
