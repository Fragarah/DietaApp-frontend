import { apiFetch, parseError } from '../../shared/api/http'
import type { AssignMealPlanPayload, MealPlanEntry } from './types'

export async function fetchMealPlan(from: string, to: string): Promise<MealPlanEntry[]> {
  const params = new URLSearchParams({ from, to })
  const response = await apiFetch(`/api/meal-plan?${params}`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<MealPlanEntry[]>
}

export async function assignMealPlan(payload: AssignMealPlanPayload): Promise<MealPlanEntry[]> {
  const response = await apiFetch('/api/meal-plan/entries', {
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
  return response.json() as Promise<MealPlanEntry[]>
}

export async function deleteMealPlanEntry(id: number, group = false): Promise<void> {
  const params = group ? '?group=true' : ''
  const response = await apiFetch(`/api/meal-plan/entries/${id}${params}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
