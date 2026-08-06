export type BaseUnit = 'g' | 'ml'

export const PORTION_UNITS = ['gram', 'mililitr', 'sztuka', 'opakowanie'] as const

export type PortionUnitName = (typeof PORTION_UNITS)[number]

export type Category = {
  id: number
  name: string
}

export type ProductPortionInput = {
  unitName: PortionUnitName | ''
  gramWeight: string
  isDefault: boolean
}

export function isFixedOneGramUnit(unitName: string): boolean {
  return unitName === 'gram'
}

export type CreateProductPayload = {
  name: string
  categoryId: number
  baseUnit: BaseUnit
  caloriesPer100: number
  proteinPer100: number
  carbsPer100: number
  fatPer100: number
  portions: {
    unitName: string
    gramWeight: number
    isDefault: boolean
  }[]
}

export type ProductResponse = {
  id: number
  categoryId: number
  categoryName: string
  name: string
  baseUnit: BaseUnit
  caloriesPer100: number
  proteinPer100: number
  carbsPer100: number
  fatPer100: number
  createdAt: string
  portions: {
    id: number
    unitName: string
    gramWeight: number
    isDefault: boolean
  }[]
}
