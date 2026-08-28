import { describe, expect, it } from 'vitest'
import type { MealResponse } from '../meals/types'
import type { ProductResponse } from '../products/types'
import {
  allocateWholePieces,
  computePortionsForPeople,
  type PersonColumn,
} from './portionMath'

describe('allocateWholePieces', () => {
  it('picks S closest to share (example: 0.44 of 4 → 2)', () => {
    expect(allocateWholePieces(4, 1500 / (1500 + 1900))).toBe(2)
  })

  it('can assign all or none', () => {
    expect(allocateWholePieces(3, 0)).toBe(0)
    expect(allocateWholePieces(3, 1)).toBe(3)
  })
})

describe('computePortionsForPeople piece split', () => {
  const eggProduct: ProductResponse = {
    id: 1,
    categoryId: 1,
    categoryName: 'Inne',
    name: 'Jajka L',
    baseUnit: 'g',
    caloriesPer100: 140,
    proteinPer100: 12.5,
    carbsPer100: 0.6,
    fatPer100: 9.7,
    createdAt: '',
    portions: [{ id: 1, unitName: 'sztuka', gramWeight: 56, isDefault: true }],
  }

  const chivesProduct: ProductResponse = {
    id: 2,
    categoryId: 2,
    categoryName: 'Warzywa',
    name: 'Szczypiorek',
    baseUnit: 'g',
    caloriesPer100: 35,
    proteinPer100: 4.1,
    carbsPer100: 4.2,
    fatPer100: 0.8,
    createdAt: '',
    portions: [{ id: 2, unitName: 'gram', gramWeight: 1, isDefault: true }],
  }

  const meal: MealResponse = {
    id: 10,
    name: 'Jajecznica',
    mealType: 'INGREDIENT',
    mealCategory: 'SNIADANIE',
    plannedDays: null,
    notes: null,
    recipeCalories: 249.2,
    recipeProtein: 20,
    recipeCarbs: 3,
    recipeFat: 16,
    ingredients: [
      {
        id: 100,
        productId: 1,
        productName: 'Jajka L',
        baseUnit: 'g',
        quantityBase: 224, // 4 × 56 g
        component: null,
        calories: 313.6, // 4 × 78.4
        protein: 28,
        carbs: 1.344,
        fat: 21.728,
      },
      {
        id: 101,
        productId: 2,
        productName: 'Szczypiorek',
        baseUnit: 'g',
        quantityBase: 40,
        component: null,
        calories: 14,
        protein: 1.64,
        carbs: 1.68,
        fat: 0.32,
      },
    ],
  }

  const oliwia: PersonColumn = {
    id: '1',
    personId: 1,
    label: 'Oliwia',
    dailyKcalLimit: 1500,
    targetKcal: '375',
  }

  const kacper: PersonColumn = {
    id: '2',
    personId: 2,
    label: 'Kacper',
    dailyKcalLimit: 1900,
    targetKcal: '475',
  }

  const productById = new Map([
    [1, eggProduct],
    [2, chivesProduct],
  ])

  it('splits eggs by daily share then remaining kcal for other products', () => {
    const portions = computePortionsForPeople(
      meal,
      [oliwia, kacper],
      3400,
      productById,
    )

    const a = portions.get(1)
    const b = portions.get(2)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()

    const eggsA = a!.lines.find((line) => line.productId === 1)!
    const eggsB = b!.lines.find((line) => line.productId === 1)!
    expect(eggsA.quantityBase).toBe(2)
    expect(eggsA.baseUnit).toBe('sztuka')
    expect(eggsB.quantityBase).toBe(2)
    expect(eggsB.baseUnit).toBe('sztuka')

    // piece kcal 156.8 each → remain 375-156.8=218.2, 475-156.8=318.2 → shareA≈0.4069
    const chivesA = a!.lines.find((line) => line.productId === 2)!
    const chivesB = b!.lines.find((line) => line.productId === 2)!
    expect(chivesA.quantityBase + chivesB.quantityBase).toBeCloseTo(40, 5)
    expect(chivesA.quantityBase).toBeCloseTo(40 * (218.2 / (218.2 + 318.2)), 1)
  })

  it('falls back to independent scale when not exactly 2 people', () => {
    const portions = computePortionsForPeople(meal, [kacper], 1900, productById)
    const only = portions.get(2)!
    const eggs = only.lines.find((line) => line.productId === 1)!
    expect(eggs.baseUnit).toBe('g')
    expect(eggs.quantityBase).toBeGreaterThan(224)
    expect(only.appliedScale).toBeCloseTo(475 / meal.recipeCalories, 4)
  })
})

describe('computePortionsForPeople WHOLE', () => {
  const wholeMeal: MealResponse = {
    id: 20,
    name: 'Garnek 3 dni',
    mealType: 'WHOLE',
    mealCategory: 'OBIAD',
    plannedDays: 3,
    notes: null,
    recipeCalories: 3000,
    recipeProtein: 0,
    recipeCarbs: 0,
    recipeFat: 0,
    ingredients: [
      {
        id: 1,
        productId: 10,
        productName: 'Kurczak',
        baseUnit: 'g',
        quantityBase: 1200,
        component: null,
        calories: 1440,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      {
        id: 2,
        productId: 11,
        productName: 'Ryż',
        baseUnit: 'g',
        quantityBase: 600,
        component: null,
        calories: 1560,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
    ],
  }

  const oliwia: PersonColumn = {
    id: '1',
    personId: 1,
    label: 'Oliwia',
    dailyKcalLimit: 1500,
    targetKcal: '525',
  }

  const kacper: PersonColumn = {
    id: '2',
    personId: 2,
    label: 'Kacper',
    dailyKcalLimit: 1900,
    targetKcal: '665',
  }

  it('splits batch into N days then by daily-limit share', () => {
    const portions = computePortionsForPeople(wholeMeal, [oliwia, kacper], 3400)
    const a = portions.get(1)!
    const b = portions.get(2)!

    // Oliwia: 1500/3400/3 ≈ 0.14706 of full batch per day
    expect(a.appliedScale).toBeCloseTo(1500 / 3400 / 3, 4)
    expect(b.appliedScale).toBeCloseTo(1900 / 3400 / 3, 4)
    expect(a.sharePercent).toBeCloseTo(44.1, 1)
    expect(b.sharePercent).toBeCloseTo(55.9, 1)

    const chickenA = a.lines.find((line) => line.productId === 10)!
    const chickenB = b.lines.find((line) => line.productId === 10)!
    expect(chickenA.quantityBase + chickenB.quantityBase).toBeCloseTo(1200 / 3, 2)
    expect(chickenA.quantityBase).toBeCloseTo(1200 * (1500 / 3400 / 3), 2)

    // Daily pot kcal split by share
    expect(a.totals.calories + b.totals.calories).toBeCloseTo(3000 / 3, 1)
  })
})
