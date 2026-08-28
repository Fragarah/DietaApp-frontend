import type { Category, CreateProductPayload, ProductResponse } from './types'
import { apiFetch, parseError } from '../../shared/api/http'

export async function fetchCategories(): Promise<Category[]> {
  const response = await apiFetch('/api/categories')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<Category[]>
}

export async function fetchProducts(): Promise<ProductResponse[]> {
  const response = await apiFetch('/api/products')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<ProductResponse[]>
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductResponse> {
  const response = await apiFetch('/api/products', {
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

export async function deleteProduct(id: number): Promise<void> {
  const response = await apiFetch(`/api/products/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}

export async function updateProduct(
  id: number,
  payload: CreateProductPayload,
): Promise<ProductResponse> {
  const response = await apiFetch(`/api/products/${id}`, {
    method: 'PUT',
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
