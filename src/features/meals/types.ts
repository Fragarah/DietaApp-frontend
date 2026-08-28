export const MEAL_TYPES = ['INGREDIENT', 'WHOLE'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_CATEGORIES = ['SNIADANIE', 'LUNCH', 'OBIAD', 'DESER', 'EXTRA'] as const
export type MealCategory = (typeof MEAL_CATEGORIES)[number]

export type MealIngredientInput = {
  productId: string
  quantityBase: string
}

export type CreateMealPayload = {
  name: string
  mealType: MealType
  mealCategory: MealCategory
  plannedDays: number | null
  notes: string | null
  ingredients: {
    productId: number
    quantityBase: number
    component: null
    sortOrder: number
  }[]
  servings: []
}

export type MealIngredientResponse = {
  id: number
  productId: number
  productName: string
  baseUnit?: string
  quantityBase: number
  component: null
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export type MealResponse = {
  id: number
  name: string
  mealType: MealType
  mealCategory: MealCategory
  plannedDays: number | null
  notes: string | null
  recipeCalories: number
  recipeProtein: number
  recipeCarbs: number
  recipeFat: number
  ingredients: MealIngredientResponse[]
}
