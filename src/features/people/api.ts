import { apiFetch, parseError } from '../../shared/api/http'
import type { PersonResponse, UpsertPersonPayload } from './types'

export async function fetchPersons(): Promise<PersonResponse[]> {
  const response = await apiFetch('/api/persons')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<PersonResponse[]>
}

export async function createPerson(payload: UpsertPersonPayload): Promise<PersonResponse> {
  const response = await apiFetch('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<PersonResponse>
}

export async function updatePerson(
  id: number,
  payload: UpsertPersonPayload,
): Promise<PersonResponse> {
  const response = await apiFetch(`/api/persons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<PersonResponse>
}

export async function deletePerson(id: number): Promise<void> {
  const response = await apiFetch(`/api/persons/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
