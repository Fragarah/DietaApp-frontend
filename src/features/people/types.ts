import type { MealCategory } from '../meals/types'

export type TargetUnit = 'KCAL' | 'PERCENT'
export type TargetMode = 'FIXED' | 'RANGE'

export type PersonMealTarget = {
  id?: number
  mealCategory: MealCategory
  unit: TargetUnit
  mode: TargetMode
  value: number | null
  minValue: number | null
  maxValue: number | null
}

export type PersonResponse = {
  id: number
  name: string
  dailyKcalLimit: number
  sortOrder: number
  mealTargets: PersonMealTarget[]
  createdAt: string
  updatedAt: string
}

export type UpsertPersonPayload = {
  name: string
  dailyKcalLimit: number
  mealTargets: Array<{
    mealCategory: MealCategory
    unit: TargetUnit
    mode: TargetMode
    value: number | null
    minValue: number | null
    maxValue: number | null
  }>
}

export type PersonMealTargetDraft = {
  mealCategory: MealCategory
  unit: TargetUnit
  mode: TargetMode
  value: string
  minValue: string
  maxValue: string
}

export type PersonDraft = {
  clientKey: string
  id: number | null
  name: string
  dailyKcalLimit: string
  /** Extra jest opcjonalne — gdy false, nie trafia do API. */
  extraEnabled: boolean
  mealTargets: PersonMealTargetDraft[]
  dirty: boolean
  saving: boolean
  error: string | null
  success: string | null
}

export const CORE_MEAL_CATEGORIES: MealCategory[] = [
  'SNIADANIE',
  'LUNCH',
  'OBIAD',
  'DESER',
]

export const PERSON_MEAL_CATEGORIES: MealCategory[] = [...CORE_MEAL_CATEGORIES, 'EXTRA']

const DEFAULT_PERCENTS: Record<MealCategory, string> = {
  SNIADANIE: '25',
  LUNCH: '25',
  OBIAD: '35',
  DESER: '15',
  EXTRA: '5',
}

function defaultTarget(mealCategory: MealCategory): PersonMealTargetDraft {
  return {
    mealCategory,
    unit: 'PERCENT',
    mode: 'FIXED',
    value: DEFAULT_PERCENTS[mealCategory],
    minValue: '',
    maxValue: '',
  }
}

export function createEmptyPersonDraft(name = ''): PersonDraft {
  return {
    clientKey: `new-${crypto.randomUUID()}`,
    id: null,
    name,
    dailyKcalLimit: '2000',
    extraEnabled: false,
    mealTargets: PERSON_MEAL_CATEGORIES.map(defaultTarget),
    dirty: true,
    saving: false,
    error: null,
    success: null,
  }
}

export function personToDraft(person: PersonResponse): PersonDraft {
  const byCategory = new Map(person.mealTargets.map((t) => [t.mealCategory, t]))
  const extra = byCategory.get('EXTRA')
  return {
    clientKey: `id-${person.id}`,
    id: person.id,
    name: person.name,
    dailyKcalLimit: String(person.dailyKcalLimit),
    extraEnabled: Boolean(extra),
    mealTargets: PERSON_MEAL_CATEGORIES.map((mealCategory) => {
      const target = byCategory.get(mealCategory)
      if (!target) {
        return defaultTarget(mealCategory)
      }
      return {
        mealCategory,
        unit: target.unit,
        mode: target.mode,
        value: target.value != null ? String(target.value) : '',
        minValue: target.minValue != null ? String(target.minValue) : '',
        maxValue: target.maxValue != null ? String(target.maxValue) : '',
      }
    }),
    dirty: false,
    saving: false,
    error: null,
    success: null,
  }
}
