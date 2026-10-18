import { describe, expect, it } from 'vitest'
import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import type { ProductResponse } from '../products/types'
import {
  averageRangeNutrition,
  buildDailyNutritionSummaries,
  macroKcalPercent,
} from './planNutrition'
import type { MealPlanEntry } from './types'

const oats: ProductResponse = {
  id: 10,
  categoryId: 1,
  categoryName: 'Zboża',
  name: 'Płatki',
  baseUnit: 'g',
  caloriesPer100: 350,
  proteinPer100: 10,
  carbsPer100: 60,
  fatPer100: 5,
  createdAt: '',
  portions: [{ id: 1, unitName: 'gram', gramWeight: 1, isDefault: true }],
}

const meal: MealResponse = {
  id: 100,
  name: 'Owsianka',
  mealType: 'INGREDIENT',
  mealCategory: 'SNIADANIE',
  plannedDays: null,
  notes: null,
  recipeCalories: 350,
  recipeProtein: 10,
  recipeCarbs: 60,
  recipeFat: 5,
  ingredients: [
    {
      id: 1,
      productId: 10,
      productName: 'Płatki',
      baseUnit: 'g',
      quantityBase: 100,
      component: null,
      calories: 350,
      protein: 10,
      carbs: 60,
      fat: 5,
    },
  ],
}

const personA: PersonResponse = {
  id: 1,
  name: 'Kacper',
  dailyKcalLimit: 2000,
  sortOrder: 0,
  mealTargets: [
    {
      mealCategory: 'SNIADANIE',
      unit: 'PERCENT',
      mode: 'FIXED',
      value: 25,
      minValue: null,
      maxValue: null,
    },
  ],
  createdAt: '',
  updatedAt: '',
}

const personB: PersonResponse = {
  ...personA,
  id: 2,
  name: 'Ola',
  sortOrder: 1,
  dailyKcalLimit: 1600,
}

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: 1,
    planDate: '2026-10-01',
    mealCategory: 'SNIADANIE',
    mealId: 100,
    mealName: 'Owsianka',
    mealType: 'INGREDIENT',
    plannedDays: null,
    batchDay: null,
    batchTotal: null,
    batchGroupId: null,
    personId: null,
    personName: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('planNutrition', () => {
  const mealsById = new Map([[100, meal]])
  const productById = new Map([[10, oats]])
  const people = [personA, personB]
  const days = ['2026-10-01', '2026-10-02']

  it('sums shared entry for all selected people on that day', () => {
    const daily = buildDailyNutritionSummaries({
      days,
      entries: [entry({ personId: null })],
      mealsById,
      people,
      productById,
    })
    const day1 = daily[0]!
    expect(day1.people).toHaveLength(2)
    expect(day1.people[0]!.totals.calories).toBeGreaterThan(0)
    expect(day1.people[1]!.totals.calories).toBeGreaterThan(0)
    expect(daily[1]!.people[0]!.totals.calories).toBe(0)
  })

  it('person entry counts only for that person', () => {
    const daily = buildDailyNutritionSummaries({
      days,
      entries: [entry({ personId: 1, personName: 'Kacper' })],
      mealsById,
      people,
      productById,
    })
    expect(daily[0]!.people[0]!.totals.calories).toBeGreaterThan(0)
    expect(daily[0]!.people[1]!.totals.calories).toBe(0)
  })

  it('range average divides by day count', () => {
    const daily = buildDailyNutritionSummaries({
      days,
      entries: [
        entry({ id: 1, planDate: '2026-10-01', personId: 1, personName: 'Kacper' }),
        entry({ id: 2, planDate: '2026-10-02', personId: 1, personName: 'Kacper' }),
      ],
      mealsById,
      people,
      productById,
    })
    const range = averageRangeNutrition(daily, people)
    const a = range.find((row) => row.personId === 1)!
    const dayCalories = daily[0]!.people[0]!.totals.calories
    expect(a.totals.calories).toBeCloseTo(dayCalories, 0)
  })

  it('macroKcalPercent uses 4/4/9 factors', () => {
    expect(macroKcalPercent(50, 'protein', 2000)).toBe(10)
    expect(macroKcalPercent(100, 'carbs', 2000)).toBe(20)
    expect(macroKcalPercent(20, 'fat', 1800)).toBe(10)
    expect(macroKcalPercent(10, 'protein', 0)).toBeNull()
  })
})
