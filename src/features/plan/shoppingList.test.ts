import { describe, expect, it } from 'vitest'
import type { MealResponse } from '../meals/types'
import type { PersonResponse } from '../people/types'
import type { ProductResponse } from '../products/types'
import { buildShoppingList, compareShoppingCategories } from './shoppingList'
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

describe('compareShoppingCategories', () => {
  it('orders owoce → warzywa → inne → mięso → nabiał → zbożowe', () => {
    const names = [
      'Produkty zbożowe',
      'Nabiał i jajka',
      'Mięso i ryby',
      'Inne',
      'Warzywa',
      'Owoce',
      'Bakalie',
    ]
    const sorted = [...names].sort(compareShoppingCategories)
    expect(sorted).toEqual([
      'Owoce',
      'Warzywa',
      'Inne',
      'Mięso i ryby',
      'Nabiał i jajka',
      'Produkty zbożowe',
      'Bakalie',
    ])
  })
})

describe('buildShoppingList person scope', () => {
  const mealsById = new Map([[100, meal]])
  const productById = new Map([[10, oats]])
  const people = [personA, personB]

  it('shared entry sums portions for all selected people', () => {
    const shared = buildShoppingList({
      entries: [entry({ personId: null })],
      mealsById,
      people,
      productById,
    })
    const onlyA = buildShoppingList({
      entries: [entry({ personId: 1, personName: 'Kacper' })],
      mealsById,
      people,
      productById,
    })
    expect(shared).toHaveLength(1)
    expect(onlyA).toHaveLength(1)
    expect(shared[0]!.grams).toBeGreaterThan(onlyA[0]!.grams)
  })

  it('person entry is skipped when person not in selection', () => {
    const items = buildShoppingList({
      entries: [entry({ personId: 2, personName: 'Ola' })],
      mealsById,
      people: [personA],
      productById,
    })
    expect(items).toHaveLength(0)
  })
})
