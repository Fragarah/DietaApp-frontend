import type { MealCategory, MealType } from '../meals/types'

export const PLAN_SLOT_CATEGORIES: MealCategory[] = ['SNIADANIE', 'LUNCH', 'OBIAD', 'DESER']

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
  createdAt: string
  updatedAt: string
}

export type AssignMealPlanPayload = {
  mealId: number
  startDate: string
  mode: MealPlanAssignMode
  replaceExisting: boolean
}
