import { useCallback, useEffect, useMemo, useState } from 'react'
import { pl } from '../../i18n/pl'
import { createMeal, deleteMeal, fetchMeals } from './api'
import {
  MEAL_CATEGORIES,
  type CreateMealPayload,
  type MealCategory,
  type MealResponse,
} from './types'
import './MealsTable.css'

function formatNumber(value: number): string {
  return Number(value).toLocaleString('pl-PL', {
    maximumFractionDigits: 2,
  })
}

function sortMealsByName(meals: MealResponse[]): MealResponse[] {
  return [...meals].sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }))
}

function normalize(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function buildCopyPayload(meal: MealResponse): CreateMealPayload {
  return {
    name: `${meal.name}${pl.meal.table.copyNameSuffix}`,
    mealType: meal.mealType,
    mealCategory: meal.mealCategory,
    plannedDays:
      meal.mealType === 'WHOLE'
        ? meal.plannedDays != null && meal.plannedDays >= 1
          ? meal.plannedDays
          : 1
        : null,
    notes: meal.notes,
    ingredients: (meal.ingredients ?? []).map((ingredient, index) => ({
      productId: Number(ingredient.productId),
      quantityBase: Number(ingredient.quantityBase),
      component: null,
      sortOrder: ingredient.sortOrder ?? index,
    })),
    servings: [],
  }
}

type MealsTableProps = {
  reloadToken?: number
  onEdit?: (meal: MealResponse) => void
}

export function MealsTable({ reloadToken = 0, onEdit }: MealsTableProps) {
  const [meals, setMeals] = useState<MealResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mealToDelete, setMealToDelete] = useState<MealResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copyingId, setCopyingId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<MealCategory | ''>('')

  const loadMeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMeals()
      setMeals(sortMealsByName(data))
    } catch {
      setError(pl.meal.table.loadFailed)
      setMeals([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMeals()
  }, [loadMeals, reloadToken])

  const filteredMeals = useMemo(() => {
    const needle = normalize(searchQuery)
    return meals.filter((meal) => {
      if (categoryFilter && meal.mealCategory !== categoryFilter) {
        return false
      }
      if (!needle) {
        return true
      }
      return normalize(meal.name).includes(needle)
    })
  }, [meals, searchQuery, categoryFilter])

  async function handleCopy(meal: MealResponse) {
    setCopyingId(meal.id)
    setError(null)
    setSuccessMessage(null)
    try {
      const payload = buildCopyPayload(meal)
      if (payload.ingredients.length === 0 || payload.ingredients.some((item) => !(item.quantityBase > 0))) {
        setError(pl.meal.table.copyFailed)
        return
      }
      const copied = await createMeal(payload)
      const data = await fetchMeals()
      setMeals(sortMealsByName(data))
      setSuccessMessage(pl.meal.table.copySuccess.replace('{name}', copied.name))
      onEdit?.(copied)
    } catch {
      setError(pl.meal.table.copyFailed)
    } finally {
      setCopyingId(null)
    }
  }

  async function confirmDelete() {
    if (!mealToDelete) {
      return
    }

    setDeleting(true)
    setError(null)
    try {
      await deleteMeal(mealToDelete.id)
      setMeals((current) => current.filter((meal) => meal.id !== mealToDelete.id))
      setSuccessMessage(pl.meal.table.deleteSuccess)
      setMealToDelete(null)
    } catch {
      setError(pl.meal.table.deleteFailed)
      setMealToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="meals-table-card">
      <header className="meals-table-card__header">
        <p className="meals-table-card__brand">{pl.appName}</p>
        <h1>{pl.meal.table.title}</h1>
      </header>

      <div className="meals-table-filters">
        <label className="meals-table-filters__search">
          <span>{pl.meal.table.searchLabel}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={pl.meal.table.searchPlaceholder}
            autoComplete="off"
          />
        </label>

        <div className="meals-table-filters__chips" role="group" aria-label={pl.meal.table.categoryFilterLabel}>
          <button
            type="button"
            className={`meals-chip${categoryFilter === '' ? ' meals-chip--active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >
            {pl.meal.table.allCategories}
          </button>
          {MEAL_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`meals-chip${categoryFilter === category ? ' meals-chip--active' : ''}`}
              onClick={() => setCategoryFilter(category)}
            >
              {pl.meal.categories[category]}
            </button>
          ))}
        </div>
      </div>

      {successMessage ? (
        <p className="meals-table-card__banner meals-table-card__banner--success" role="status">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="meals-table-card__banner meals-table-card__banner--error" role="alert">
          {error}
          <button type="button" className="btn btn--secondary" onClick={() => void loadMeals()}>
            {pl.actions.retry}
          </button>
        </p>
      ) : null}

      {loading ? <p className="meals-table-card__status">{pl.meal.table.loading}</p> : null}

      {!loading && !error && meals.length === 0 ? (
        <p className="meals-table-card__status">{pl.meal.table.empty}</p>
      ) : null}

      {!loading && meals.length > 0 && filteredMeals.length === 0 ? (
        <p className="meals-table-card__status">{pl.meal.table.noMatches}</p>
      ) : null}

      {!loading && filteredMeals.length > 0 ? (
        <div className="meals-table-wrap">
          <table className="meals-table">
            <thead>
              <tr>
                <th>{pl.meal.table.columns.name}</th>
                <th>{pl.meal.table.columns.category}</th>
                <th>{pl.meal.table.columns.type}</th>
                <th>{pl.meal.table.columns.ingredients}</th>
                <th>{pl.meal.table.columns.calories}</th>
                <th>{pl.meal.table.columns.protein}</th>
                <th>{pl.meal.table.columns.carbs}</th>
                <th>{pl.meal.table.columns.fat}</th>
                <th className="meals-table__actions-col">{pl.meal.table.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeals.map((meal) => (
                <tr key={meal.id}>
                  <td>{meal.name}</td>
                  <td>{pl.meal.categories[meal.mealCategory]}</td>
                  <td>{pl.meal.types[meal.mealType]}</td>
                  <td>{meal.ingredients?.length ?? 0}</td>
                  <td>{formatNumber(meal.recipeCalories)}</td>
                  <td>
                    {formatNumber(meal.recipeProtein)} {pl.meal.summary.grams}
                  </td>
                  <td>
                    {formatNumber(meal.recipeCarbs)} {pl.meal.summary.grams}
                  </td>
                  <td>
                    {formatNumber(meal.recipeFat)} {pl.meal.summary.grams}
                  </td>
                  <td className="meals-table__actions-col">
                    <div className="meals-table__actions">
                      <button
                        type="button"
                        className="btn-edit"
                        aria-label={`${pl.meal.table.editMeal}: ${meal.name}`}
                        title={pl.meal.table.editMeal}
                        onClick={() => onEdit?.(meal)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn-copy"
                        aria-label={`${pl.meal.table.copyMeal}: ${meal.name}`}
                        title={pl.meal.table.copyMeal}
                        disabled={copyingId === meal.id}
                        onClick={() => void handleCopy(meal)}
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        aria-label={`${pl.meal.table.deleteMeal}: ${meal.name}`}
                        title={pl.meal.table.deleteMeal}
                        onClick={() => {
                          setSuccessMessage(null)
                          setMealToDelete(meal)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {mealToDelete ? (
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={() => {
            if (!deleting) {
              setMealToDelete(null)
            }
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-meal-dialog-title"
            aria-describedby="delete-meal-dialog-message"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-meal-dialog-title">{pl.meal.table.deleteConfirmTitle}</h2>
            <p id="delete-meal-dialog-message">
              {pl.meal.table.deleteConfirmMessage.replace('{name}', mealToDelete.name)}
            </p>
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="btn btn--danger"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? pl.actions.deleting : pl.meal.table.deleteConfirmYes}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={deleting}
                onClick={() => setMealToDelete(null)}
              >
                {pl.meal.table.deleteConfirmNo}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
