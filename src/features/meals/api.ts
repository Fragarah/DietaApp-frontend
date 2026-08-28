import type { CreateMealPayload, MealResponse } from './types'
import { apiFetch, parseError } from '../../shared/api/http'

export async function fetchMeals(): Promise<MealResponse[]> {
  const response = await apiFetch('/api/meals')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<MealResponse[]>
}

export async function createMeal(payload: CreateMealPayload): Promise<MealResponse> {
  const response = await apiFetch('/api/meals', {
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

  return response.json() as Promise<MealResponse>
}

export async function updateMeal(
  id: number,
  payload: CreateMealPayload,
): Promise<MealResponse> {
  const response = await apiFetch(`/api/meals/${id}`, {
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

  return response.json() as Promise<MealResponse>
}

export async function deleteMeal(id: number): Promise<void> {
  const response = await apiFetch(`/api/meals/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
