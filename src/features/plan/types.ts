import type { MealCategory, MealType } from '../meals/types'
import type { PersonResponse } from '../people/types'

export const PLAN_SLOT_CATEGORIES = ['SNIADANIE', 'LUNCH', 'OBIAD', 'DESER'] as const

export type PlanSlotCategory = (typeof PLAN_SLOT_CATEGORIES)[number]

export type MealPlanAssignMode = 'SINGLE' | 'WHOLE_BATCH'

export type MealPlanEntry = {
  id: number
  planDate: string
  mealCategory: MealCategory
  mealId: number
  mealName: string
  mealType: MealType
  plannedDays: number | null
  batchDay: number | null
  batchTotal: number | null
  batchGroupId: string | null
  /** null = wpis wspólny (obie osoby) */
  personId: number | null
  personName: string | null
  createdAt: string
  updatedAt: string
}

export type AssignMealPlanPayload = {
  mealId: number
  startDate: string
  mode: MealPlanAssignMode
  replaceExisting: boolean
  /** null/undefined = wspólny; number = tylko ta osoba */
  personId?: number | null
}

/** Osoby, dla których liczymy porcje z wpisu planu. */
export function peopleForPlanEntry(
  entry: MealPlanEntry,
  people: PersonResponse[],
): PersonResponse[] {
  if (entry.personId == null) {
    return people
  }
  return people.filter((person) => person.id === entry.personId)
}

export function personInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed[0]!.toLocaleUpperCase('pl-PL') : '?'
}

export function formatPlanEntryLabel(entry: MealPlanEntry): string {
  if (entry.personId == null) {
    return entry.mealName
  }
  const initial = personInitial(entry.personName ?? '')
  return `${initial}: ${entry.mealName}`
}
