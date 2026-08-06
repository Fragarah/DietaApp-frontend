import type { Category, CreateProductPayload, ProductResponse } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function parseError(response: Response): Promise<string> {
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

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<Category[]>
}

export async function fetchProducts(): Promise<ProductResponse[]> {
  const response = await fetch(`${API_URL}/api/products`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<ProductResponse[]>
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductResponse> {
  const response = await fetch(`${API_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await parseError(response)
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return response.json() as Promise<ProductResponse>
}
