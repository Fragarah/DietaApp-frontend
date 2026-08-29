import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { pl } from '../../i18n/pl'
import { countableUnitLabel, formatCountableUnit } from '../../i18n/plCount'
import { fetchProducts } from '../products/api'
import {
  getDefaultPortion,
  isCountableUnit,
  type ProductResponse,
} from '../products/types'
import { createMeal, updateMeal } from './api'
import { ProductSearchField } from './ProductSearchField'
import {
  MEAL_CATEGORIES,
  MEAL_TYPES,
  type MealCategory,
  type MealIngredientInput,
  type MealIngredientResponse,
  type MealResponse,
  type MealType,
} from './types'
import './MealForm.css'

type FormErrors = Partial<Record<string, string>>

type MealFormProps = {
  meal?: MealResponse
  onCancel?: () => void
  onSaved?: () => void
}

type QuantityMode = {
  unitLabel: string
  unitName: string
  countable: boolean
  gramWeight: number | null
}

const emptyIngredient = (): MealIngredientInput => ({
  clientKey: crypto.randomUUID(),
  productId: '',
  quantityBase: '',
})

function sortIngredientResponses(ingredients: MealIngredientResponse[]): MealIngredientResponse[] {
  return [...ingredients].sort((a, b) => {
    const orderA = a.sortOrder ?? a.id
    const orderB = b.sortOrder ?? b.id
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return a.id - b.id
  })
}

function toNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  return Number(normalized)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function formatInputNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return String(round2(value))
}

function resolveQuantityMode(product: ProductResponse | undefined): QuantityMode {
  if (!product) {
    return { unitLabel: '', unitName: '', countable: false, gramWeight: null }
  }

  const portion = getDefaultPortion(product)
  if (portion && isCountableUnit(portion.unitName) && portion.gramWeight > 0) {
    return {
      unitLabel: countableUnitLabel(portion.unitName),
      unitName: portion.unitName,
      countable: true,
      gramWeight: portion.gramWeight,
    }
  }

  return {
    unitLabel: product.baseUnit,
    unitName: product.baseUnit,
    countable: false,
    gramWeight: null,
  }
}

/** Formularz trzyma sztuki / g w polu; API zawsze dostaje gramy (lub ml). */
function toStoredQuantityBase(displayQty: number, mode: QuantityMode): number {
  if (mode.countable && mode.gramWeight != null) {
    return round2(displayQty * mode.gramWeight)
  }
  return displayQty
}

function toDisplayQuantity(storedGrams: number, mode: QuantityMode): string {
  if (mode.countable && mode.gramWeight != null && mode.gramWeight > 0) {
    return formatInputNumber(storedGrams / mode.gramWeight)
  }
  return formatInputNumber(storedGrams)
}

function ingredientsFromMeal(
  meal: MealResponse,
  productById: Map<number, ProductResponse>,
): MealIngredientInput[] {
  if (!meal.ingredients || meal.ingredients.length === 0) {
    return [emptyIngredient()]
  }
  return sortIngredientResponses(meal.ingredients).map((ingredient) => {
    const product = productById.get(ingredient.productId)
    const mode = resolveQuantityMode(product)
    return {
      clientKey: `ing-${ingredient.id}`,
      productId: String(ingredient.productId),
      quantityBase: toDisplayQuantity(Number(ingredient.quantityBase), mode),
    }
  })
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list
  }
  const next = [...list]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function MealForm({ meal, onCancel, onSaved }: MealFormProps) {
  const isEdit = Boolean(meal)

  const [products, setProducts] = useState<ProductResponse[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  const [name, setName] = useState(meal?.name ?? '')
  const [mealCategory, setMealCategory] = useState<MealCategory | ''>(meal?.mealCategory ?? '')
  const initialType: MealType =
    meal?.mealType === 'INGREDIENT' || meal?.mealType === 'WHOLE' ? meal.mealType : 'WHOLE'
  const [mealType, setMealType] = useState<MealType>(initialType)
  const [plannedDays, setPlannedDays] = useState(
    meal?.plannedDays != null ? String(meal.plannedDays) : '1',
  )
  const [notes, setNotes] = useState(meal?.notes ?? '')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [ingredients, setIngredients] = useState<MealIngredientInput[]>(() =>
    meal
      ? meal.ingredients?.length
        ? sortIngredientResponses(meal.ingredients).map((ingredient) => ({
            clientKey: `ing-${ingredient.id}`,
            productId: String(ingredient.productId),
            quantityBase: String(ingredient.quantityBase),
          }))
        : [emptyIngredient()]
      : [emptyIngredient()],
  )
  const [displayUnitsReady, setDisplayUnitsReady] = useState(!isEdit)
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setProductsLoading(true)
      setProductsError(null)
      try {
        const data = await fetchProducts()
        if (!cancelled) {
          setProducts(data)
        }
      } catch {
        if (!cancelled) {
          setProductsError(pl.meal.errors.loadProducts)
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false)
        }
      }
    }

    void loadProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const productById = useMemo(() => {
    const map = new Map<number, ProductResponse>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  useEffect(() => {
    if (!meal || products.length === 0 || displayUnitsReady) {
      return
    }
    setIngredients(ingredientsFromMeal(meal, productById))
    setDisplayUnitsReady(true)
  }, [meal, products, productById, displayUnitsReady])

  useEffect(() => {
    const el = notesRef.current
    if (!el) {
      return
    }
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [notes])

  const recipePreview = useMemo(() => {
    let calories = 0
    let protein = 0
    let carbs = 0
    let fat = 0
    for (const ingredient of ingredients) {
      const productId = Number(ingredient.productId)
      const displayQty = toNumber(ingredient.quantityBase)
      const product = productById.get(productId)
      if (!product || Number.isNaN(displayQty) || displayQty <= 0) {
        continue
      }
      const mode = resolveQuantityMode(product)
      const quantityBase = toStoredQuantityBase(displayQty, mode)
      const factor = quantityBase / 100
      calories += product.caloriesPer100 * factor
      protein += product.proteinPer100 * factor
      carbs += product.carbsPer100 * factor
      fat += product.fatPer100 * factor
    }
    return {
      calories: round2(calories),
      protein: round2(protein),
      carbs: round2(carbs),
      fat: round2(fat),
    }
  }, [ingredients, productById])

  function validate(): FormErrors {
    const next: FormErrors = {}

    if (!name.trim()) {
      next.name = pl.meal.errors.nameRequired
    }
    if (!mealCategory) {
      next.mealCategory = pl.meal.errors.categoryRequired
    }

    if (ingredients.length === 0) {
      next.ingredients = pl.meal.errors.ingredientsRequired
    }

    ingredients.forEach((ingredient, index) => {
      if (!ingredient.productId) {
        next[`ingredient-product-${index}`] = pl.meal.errors.productRequired
      }
      const quantity = toNumber(ingredient.quantityBase)
      const product = productById.get(Number(ingredient.productId))
      const mode = resolveQuantityMode(product)
      if (
        ingredient.quantityBase.trim() === '' ||
        Number.isNaN(quantity) ||
        quantity <= 0
      ) {
        next[`ingredient-qty-${index}`] = pl.meal.errors.quantityRequired
      } else if (mode.countable && (!Number.isInteger(quantity) || quantity < 1)) {
        next[`ingredient-qty-${index}`] = pl.meal.errors.quantityIntegerRequired
      }
    })

    if (mealType === 'WHOLE') {
      const days = toNumber(plannedDays)
      if (
        plannedDays.trim() === '' ||
        Number.isNaN(days) ||
        days < 1 ||
        !Number.isInteger(days)
      ) {
        next.plannedDays = pl.meal.errors.batchDaysInvalid
      }
    }

    return next
  }

  function resetForm() {
    setName('')
    setMealCategory('')
    setMealType('WHOLE')
    setPlannedDays('1')
    setNotes('')
    setIngredients([emptyIngredient()])
    setErrors({})
    setSubmitError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage(null)
    setSubmitError(null)

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const payload = {
      name: name.trim(),
      mealType,
      mealCategory: mealCategory as MealCategory,
      plannedDays: mealType === 'WHOLE' ? toNumber(plannedDays) : null,
      notes: notes.trim() === '' ? null : notes.trim(),
      ingredients: ingredients.map((ingredient, index) => {
        const product = productById.get(Number(ingredient.productId))
        const mode = resolveQuantityMode(product)
        return {
          productId: Number(ingredient.productId),
          quantityBase: toStoredQuantityBase(toNumber(ingredient.quantityBase), mode),
          component: null,
          sortOrder: index,
        }
      }),
      servings: [] as [],
    }

    setSubmitting(true)
    try {
      if (isEdit && meal) {
        await updateMeal(meal.id, payload)
        setSuccessMessage(pl.meal.updateSuccess)
        onSaved?.()
      } else {
        await createMeal(payload)
        setSuccessMessage(pl.meal.success)
        resetForm()
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : isEdit
            ? pl.meal.errors.updateFailed
            : pl.meal.errors.saveFailed,
      )
    } finally {
      setSubmitting(false)
    }
  }

  function updateIngredient(index: number, patch: Partial<MealIngredientInput>) {
    setIngredients((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    )
  }

  function handleIngredientDragStart(index: number, event: DragEvent<HTMLButtonElement>) {
    setDragFromIndex(index)
    setDragOverIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  function handleIngredientDragOver(index: number, event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  function handleIngredientDrop(index: number, event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
    const from =
      dragFromIndex ??
      Number(event.dataTransfer.getData('text/plain'))
    if (Number.isNaN(from)) {
      setDragFromIndex(null)
      setDragOverIndex(null)
      return
    }
    setIngredients((current) => reorderList(current, from, index))
    setDragFromIndex(null)
    setDragOverIndex(null)
  }

  function handleIngredientDragEnd() {
    setDragFromIndex(null)
    setDragOverIndex(null)
  }

  return (
    <form className="meal-form" onSubmit={handleSubmit} noValidate>
      <header className="meal-form__header">
        <p className="meal-form__brand">{pl.appName}</p>
        <h1>{isEdit ? pl.meal.editTitle : pl.meal.pageTitle}</h1>
        <p className="meal-form__subtitle">
          {isEdit ? pl.meal.editSubtitle : pl.meal.pageSubtitle}
        </p>
      </header>

      {successMessage ? (
        <p className="meal-form__banner meal-form__banner--success" role="status">
          {successMessage}
        </p>
      ) : null}
      {submitError ? (
        <p className="meal-form__banner meal-form__banner--error" role="alert">
          {submitError}
        </p>
      ) : null}
      {productsError ? (
        <p className="meal-form__banner meal-form__banner--error" role="alert">
          {productsError}
        </p>
      ) : null}

      <section className="meal-section">
        <div className="meal-section__head">
          <h2>{pl.meal.sections.basics}</h2>
          <p>{pl.meal.hints.basics}</p>
        </div>

        <div className="meal-form__grid">
          <label className="field">
            <span>{pl.meal.fields.name}</span>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={pl.meal.placeholders.name}
              autoComplete="off"
            />
            {errors.name ? <span className="field__error">{errors.name}</span> : null}
          </label>

          <label className="field">
            <span>{pl.meal.fields.mealCategory}</span>
            <select
              value={mealCategory}
              onChange={(event) => setMealCategory(event.target.value as MealCategory | '')}
            >
              <option value="">{pl.meal.placeholders.mealCategory}</option>
              {MEAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {pl.meal.categories[category]}
                </option>
              ))}
            </select>
            {errors.mealCategory ? (
              <span className="field__error">{errors.mealCategory}</span>
            ) : null}
          </label>

          {mealType === 'WHOLE' ? (
            <div className="meal-form__type-row">
              <fieldset className="field">
                <legend>{pl.meal.fields.mealType}</legend>
                <div className="segmented">
                  {MEAL_TYPES.map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="mealType"
                        value={type}
                        checked={mealType === type}
                        onChange={() => setMealType(type)}
                      />
                      {pl.meal.types[type]}
                    </label>
                  ))}
                </div>
                <p className="field__hint">{pl.meal.hints.types[mealType]}</p>
              </fieldset>

              <label className="field">
                <span>{pl.meal.fields.plannedDays}</span>
                <input
                  inputMode="numeric"
                  value={plannedDays}
                  onChange={(event) => setPlannedDays(event.target.value)}
                />
                {errors.plannedDays ? (
                  <span className="field__error">{errors.plannedDays}</span>
                ) : null}
              </label>
            </div>
          ) : (
            <fieldset className="field field--span">
              <legend>{pl.meal.fields.mealType}</legend>
              <div className="segmented">
                {MEAL_TYPES.map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="mealType"
                      value={type}
                      checked={mealType === type}
                      onChange={() => setMealType(type)}
                    />
                    {pl.meal.types[type]}
                  </label>
                ))}
              </div>
              <p className="field__hint">{pl.meal.hints.types[mealType]}</p>
            </fieldset>
          )}

          <label className="field field--span">
            <span>{pl.meal.fields.notes}</span>
            <textarea
              ref={notesRef}
              className="field__notes"
              rows={1}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={pl.meal.placeholders.notes}
            />
          </label>
        </div>
      </section>

      <section className="meal-section">
        <div className="meal-section__head">
          <h2>{pl.meal.sections.ingredients}</h2>
          <p>{pl.meal.hints.ingredients}</p>
        </div>
        {errors.ingredients ? <p className="field__error">{errors.ingredients}</p> : null}

        <ul className="meal-list">
          {ingredients.map((ingredient, index) => {
            const selected = productById.get(Number(ingredient.productId))
            const mode = resolveQuantityMode(selected)
            const enteredQty = toNumber(ingredient.quantityBase)
            const unitForLabel =
              mode.countable && mode.unitName && !Number.isNaN(enteredQty) && enteredQty > 0
                ? formatCountableUnit(mode.unitName, enteredQty)
                : mode.unitLabel
            const quantityLabel =
              mode.countable && mode.gramWeight != null
                ? `${pl.meal.fields.quantityBase} (${unitForLabel} · ${formatInputNumber(mode.gramWeight)} g)`
                : mode.unitLabel
                  ? `${pl.meal.fields.quantityBase} (${mode.unitLabel})`
                  : pl.meal.fields.quantityBase
            const rowClass = [
              'meal-row',
              'meal-row--ingredient',
              dragFromIndex === index ? 'meal-row--dragging' : '',
              dragOverIndex === index && dragFromIndex != null && dragFromIndex !== index
                ? 'meal-row--drop-target'
                : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <li
                key={ingredient.clientKey}
                className={rowClass}
                onDragOver={(event) => handleIngredientDragOver(index, event)}
                onDrop={(event) => handleIngredientDrop(index, event)}
              >
                <button
                  type="button"
                  className="meal-row__drag"
                  draggable={ingredients.length > 1}
                  disabled={ingredients.length === 1}
                  aria-label={pl.meal.actions.reorderIngredient}
                  title={pl.meal.actions.reorderIngredient}
                  onDragStart={(event) => handleIngredientDragStart(index, event)}
                  onDragEnd={handleIngredientDragEnd}
                >
                  <svg
                    className="meal-row__drag-icon"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 1.5 4.5 5h7L8 1.5Zm0 13L4.5 11h7L8 14.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>

                <ProductSearchField
                  label={pl.meal.fields.product}
                  products={products}
                  value={ingredient.productId}
                  onChange={(productId) =>
                    updateIngredient(index, {
                      productId,
                      quantityBase:
                        productId === ingredient.productId ? ingredient.quantityBase : '',
                    })
                  }
                  disabled={Boolean(productsError)}
                  loading={productsLoading}
                  placeholder={pl.meal.placeholders.productSearch}
                  loadingLabel={pl.meal.loadingProducts}
                  emptyLabel={pl.meal.errors.noProductMatches}
                  error={errors[`ingredient-product-${index}`]}
                />

                <label className="field">
                  <span>{quantityLabel}</span>
                  <input
                    inputMode={mode.countable ? 'numeric' : 'decimal'}
                    value={ingredient.quantityBase}
                    onChange={(event) =>
                      updateIngredient(index, { quantityBase: event.target.value })
                    }
                  />
                  {errors[`ingredient-qty-${index}`] ? (
                    <span className="field__error">
                      {errors[`ingredient-qty-${index}`]}
                    </span>
                  ) : null}
                </label>

                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    setIngredients((current) =>
                      current.length === 1
                        ? current
                        : current.filter((_, i) => i !== index),
                    )
                  }
                  disabled={ingredients.length === 1}
                >
                  {pl.meal.actions.removeIngredient}
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => setIngredients((current) => [...current, emptyIngredient()])}
        >
          {pl.meal.actions.addIngredient}
        </button>
      </section>

      <section className="meal-summary" aria-live="polite">
        <h2>{pl.meal.sections.summary}</h2>
        <dl className="meal-summary__grid">
          <div>
            <dt>{pl.meal.summary.calories}</dt>
            <dd>{recipePreview.calories}</dd>
          </div>
          <div>
            <dt>{pl.meal.summary.protein}</dt>
            <dd>
              {recipePreview.protein} {pl.meal.summary.grams}
            </dd>
          </div>
          <div>
            <dt>{pl.meal.summary.carbs}</dt>
            <dd>
              {recipePreview.carbs} {pl.meal.summary.grams}
            </dd>
          </div>
          <div>
            <dt>{pl.meal.summary.fat}</dt>
            <dd>
              {recipePreview.fat} {pl.meal.summary.grams}
            </dd>
          </div>
        </dl>
        <p className="meal-summary__note">{pl.meal.hints.summary}</p>
      </section>

      <div className="meal-form__actions">
        {onCancel ? (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {pl.meal.actions.cancel}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={resetForm}>
            {pl.meal.actions.reset}
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={submitting || productsLoading}>
          {submitting
            ? pl.meal.actions.submitting
            : isEdit
              ? pl.meal.actions.saveChanges
              : pl.meal.actions.submit}
        </button>
      </div>
    </form>
  )
}
