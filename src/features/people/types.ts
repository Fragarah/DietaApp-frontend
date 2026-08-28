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

export type PersonDraft = {
  clientKey: string
  id: number | null
  name: string
  dailyKcalLimit: string
  mealTargets: Array<{
    mealCategory: MealCategory
    unit: TargetUnit
    mode: TargetMode
    value: string
    minValue: string
    maxValue: string
  }>
  dirty: boolean
  saving: boolean
  error: string | null
  success: string | null
}

export const PERSON_MEAL_CATEGORIES: MealCategory[] = [
  'SNIADANIE',
  'LUNCH',
  'OBIAD',
  'DESER',
  'EXTRA',
]

const DEFAULT_PERCENTS: Record<MealCategory, string> = {
  SNIADANIE: '25',
  LUNCH: '20',
  OBIAD: '35',
  DESER: '15',
  EXTRA: '5',
}

export function createEmptyPersonDraft(name = ''): PersonDraft {
  return {
    clientKey: `new-${crypto.randomUUID()}`,
    id: null,
    name,
    dailyKcalLimit: '2000',
    mealTargets: PERSON_MEAL_CATEGORIES.map((mealCategory) => ({
      mealCategory,
      unit: 'PERCENT',
      mode: 'FIXED',
      value: DEFAULT_PERCENTS[mealCategory],
      minValue: '',
      maxValue: '',
    })),
    dirty: true,
    saving: false,
    error: null,
    success: null,
  }
}

export function personToDraft(person: PersonResponse): PersonDraft {
  const byCategory = new Map(person.mealTargets.map((t) => [t.mealCategory, t]))
  return {
    clientKey: `id-${person.id}`,
    id: person.id,
    name: person.name,
    dailyKcalLimit: String(person.dailyKcalLimit),
    mealTargets: PERSON_MEAL_CATEGORIES.map((mealCategory) => {
      const target = byCategory.get(mealCategory)
      return {
        mealCategory,
        unit: target?.unit ?? 'PERCENT',
        mode: target?.mode ?? 'FIXED',
        value: target?.value != null ? String(target.value) : '',
        minValue: target?.minValue != null ? String(target.minValue) : '',
        maxValue: target?.maxValue != null ? String(target.maxValue) : '',
      }
    }),
    dirty: false,
    saving: false,
    error: null,
    success: null,
  }
}
