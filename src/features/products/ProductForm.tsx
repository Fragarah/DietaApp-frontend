import { useEffect, useState, type FormEvent } from 'react'
import { pl } from '../../i18n/pl'
import { createProduct, fetchCategories, updateProduct } from './api'
import {
  PORTION_UNITS,
  isFixedOneGramUnit,
  type BaseUnit,
  type Category,
  type PortionUnitName,
  type ProductPortionInput,
  type ProductResponse,
} from './types'
import './ProductForm.css'

type FormErrors = Partial<Record<string, string>>

type ProductFormProps = {
  product?: ProductResponse
  onCancel?: () => void
  onSaved?: () => void
}

const emptyPortion = (isDefault = false): ProductPortionInput => ({
  unitName: 'gram',
  gramWeight: '1',
  isDefault,
})

function toNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  return Number(normalized)
}

function resolvePortionWeight(portion: ProductPortionInput): number {
  if (isFixedOneGramUnit(portion.unitName)) {
    return 1
  }
  return toNumber(portion.gramWeight)
}

function toPortionUnit(unitName: string): PortionUnitName | '' {
  return (PORTION_UNITS as readonly string[]).includes(unitName)
    ? (unitName as PortionUnitName)
    : ''
}

function portionsFromProduct(product: ProductResponse): ProductPortionInput[] {
  if (product.portions.length === 0) {
    return [emptyPortion(true)]
  }
  return product.portions.map((portion) => ({
    unitName: toPortionUnit(portion.unitName),
    gramWeight: String(portion.gramWeight),
    isDefault: portion.isDefault,
  }))
}

export function ProductForm({ product, onCancel, onSaved }: ProductFormProps) {
  const isEdit = Boolean(product)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product ? String(product.categoryId) : '')
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(product?.baseUnit ?? 'g')
  const [calories, setCalories] = useState(product ? String(product.caloriesPer100) : '')
  const [protein, setProtein] = useState(product ? String(product.proteinPer100) : '')
  const [carbs, setCarbs] = useState(product ? String(product.carbsPer100) : '')
  const [fat, setFat] = useState(product ? String(product.fatPer100) : '')
  const [portions, setPortions] = useState<ProductPortionInput[]>(
    product ? portionsFromProduct(product) : [emptyPortion(true)],
  )

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      setCategoriesLoading(true)
      setCategoriesError(null)
      try {
        const data = await fetchCategories()
        if (!cancelled) {
          setCategories(data)
        }
      } catch {
        if (!cancelled) {
          setCategoriesError(pl.errors.loadCategories)
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false)
        }
      }
    }

    void loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  function validate(): FormErrors {
    const next: FormErrors = {}

    if (!name.trim()) {
      next.name = pl.errors.nameRequired
    }
    if (!categoryId) {
      next.categoryId = pl.errors.categoryRequired
    }

    for (const [key, value] of [
      ['calories', calories],
      ['protein', protein],
      ['carbs', carbs],
      ['fat', fat],
    ] as const) {
      const num = toNumber(value)
      if (value.trim() === '' || Number.isNaN(num) || num < 0) {
        next[key] = pl.errors.nonNegative
      }
    }

    const defaultCount = portions.filter((portion) => portion.isDefault).length
    if (defaultCount !== 1) {
      next.portions = pl.errors.defaultPortionRequired
    }

    portions.forEach((portion, index) => {
      if (!portion.unitName) {
        next[`portion-unit-${index}`] = pl.errors.portionUnitRequired
        return
      }
      if (isFixedOneGramUnit(portion.unitName)) {
        return
      }
      const weight = toNumber(portion.gramWeight)
      if (portion.gramWeight.trim() === '' || Number.isNaN(weight) || weight <= 0) {
        next[`portion-weight-${index}`] = pl.errors.portionWeightRequired
      }
    })

    return next
  }

  function resetForm() {
    setName('')
    setCategoryId('')
    setBaseUnit('g')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setPortions([emptyPortion(true)])
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
      categoryId: Number(categoryId),
      baseUnit,
      caloriesPer100: toNumber(calories),
      proteinPer100: toNumber(protein),
      carbsPer100: toNumber(carbs),
      fatPer100: toNumber(fat),
      portions: portions.map((portion) => ({
        unitName: portion.unitName as PortionUnitName,
        gramWeight: resolvePortionWeight(portion),
        isDefault: portion.isDefault,
      })),
    }

    setSubmitting(true)
    try {
      if (isEdit && product) {
        await updateProduct(product.id, payload)
        setSuccessMessage(pl.updateSuccess)
        onSaved?.()
      } else {
        await createProduct(payload)
        setSuccessMessage(pl.success)
        resetForm()
      }
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (status === 409) {
        setSubmitError(pl.errors.conflict)
      } else {
        setSubmitError(
          error instanceof Error && error.message
            ? error.message
            : isEdit
              ? pl.errors.updateFailed
              : pl.errors.saveFailed,
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  function updatePortion(index: number, patch: Partial<ProductPortionInput>) {
    setPortions((current) =>
      current.map((portion, i) => {
        if (i !== index) {
          if (patch.isDefault === true) {
            return { ...portion, isDefault: false }
          }
          return portion
        }
        return { ...portion, ...patch }
      }),
    )
  }

  function updatePortionUnit(index: number, unitName: PortionUnitName | '') {
    setPortions((current) =>
      current.map((portion, i) => {
        if (i !== index) {
          return portion
        }
        if (isFixedOneGramUnit(unitName)) {
          return { ...portion, unitName, gramWeight: '1' }
        }
        return {
          ...portion,
          unitName,
          gramWeight: isFixedOneGramUnit(portion.unitName) ? '' : portion.gramWeight,
        }
      }),
    )
  }

  function addPortion() {
    setPortions((current) => [...current, emptyPortion(false)])
  }

  function removePortion(index: number) {
    setPortions((current) => {
      if (current.length === 1) {
        return current
      }
      const next = current.filter((_, i) => i !== index)
      if (!next.some((portion) => portion.isDefault) && next[0]) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })
  }

  return (
    <form className="product-form" onSubmit={handleSubmit} noValidate>
      <header className="product-form__header">
        <p className="product-form__brand">{pl.appName}</p>
        <h1>{isEdit ? pl.editTitle : pl.pageTitle}</h1>
        <p className="product-form__subtitle">{isEdit ? pl.editSubtitle : pl.pageSubtitle}</p>
      </header>

      {successMessage ? (
        <p className="product-form__banner product-form__banner--success" role="status">
          {successMessage}
        </p>
      ) : null}
      {submitError ? (
        <p className="product-form__banner product-form__banner--error" role="alert">
          {submitError}
        </p>
      ) : null}
      {categoriesError ? (
        <p className="product-form__banner product-form__banner--error" role="alert">
          {categoriesError}
        </p>
      ) : null}

      <div className="product-form__grid">
        <label className="field">
          <span>{pl.fields.name}</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={pl.placeholders.name}
            autoComplete="off"
          />
          {errors.name ? <span className="field__error">{errors.name}</span> : null}
        </label>

        <label className="field">
          <span>{pl.fields.category}</span>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={categoriesLoading || Boolean(categoriesError)}
          >
            <option value="">{categoriesLoading ? pl.loadingCategories : pl.placeholders.category}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId ? <span className="field__error">{errors.categoryId}</span> : null}
        </label>

        <fieldset className="field field--span">
          <legend>{pl.fields.baseUnit}</legend>
          <div className="segmented">
            <label>
              <input
                type="radio"
                name="baseUnit"
                value="g"
                checked={baseUnit === 'g'}
                onChange={() => setBaseUnit('g')}
              />
              {pl.units.g}
            </label>
            <label>
              <input
                type="radio"
                name="baseUnit"
                value="ml"
                checked={baseUnit === 'ml'}
                onChange={() => setBaseUnit('ml')}
              />
              {pl.units.ml}
            </label>
          </div>
        </fieldset>

        <label className="field">
          <span>{pl.fields.calories}</span>
          <input
            name="calories"
            inputMode="decimal"
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
          />
          {errors.calories ? <span className="field__error">{errors.calories}</span> : null}
        </label>

        <label className="field">
          <span>{pl.fields.protein}</span>
          <input
            name="protein"
            inputMode="decimal"
            value={protein}
            onChange={(event) => setProtein(event.target.value)}
          />
          {errors.protein ? <span className="field__error">{errors.protein}</span> : null}
        </label>

        <label className="field">
          <span>{pl.fields.carbs}</span>
          <input
            name="carbs"
            inputMode="decimal"
            value={carbs}
            onChange={(event) => setCarbs(event.target.value)}
          />
          {errors.carbs ? <span className="field__error">{errors.carbs}</span> : null}
        </label>

        <label className="field">
          <span>{pl.fields.fat}</span>
          <input
            name="fat"
            inputMode="decimal"
            value={fat}
            onChange={(event) => setFat(event.target.value)}
          />
          {errors.fat ? <span className="field__error">{errors.fat}</span> : null}
        </label>
      </div>

      <section className="portions">
        <div className="portions__head">
          <h2>{pl.fields.portions}</h2>
          <p>{pl.hints.portions}</p>
        </div>
        {errors.portions ? <p className="field__error">{errors.portions}</p> : null}

        <ul className="portions__list">
          {portions.map((portion, index) => {
            const fixedGram = isFixedOneGramUnit(portion.unitName)

            return (
              <li key={index} className="portion-row">
                <label className="field">
                  <span>{pl.fields.unitName}</span>
                  <select
                    value={portion.unitName}
                    onChange={(event) =>
                      updatePortionUnit(index, event.target.value as PortionUnitName | '')
                    }
                  >
                    <option value="" disabled>
                      {pl.placeholders.unitName}
                    </option>
                    {PORTION_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {pl.portionUnits[unit]}
                      </option>
                    ))}
                  </select>
                  {errors[`portion-unit-${index}`] ? (
                    <span className="field__error">{errors[`portion-unit-${index}`]}</span>
                  ) : null}
                </label>

                {fixedGram ? (
                  <div className="field">
                    <span>{pl.fields.gramWeight}</span>
                    <p className="field__hint">{pl.hints.gramUnitFixed}</p>
                  </div>
                ) : (
                  <label className="field">
                    <span>{pl.fields.gramWeight}</span>
                    <input
                      inputMode="decimal"
                      value={portion.gramWeight}
                      onChange={(event) => updatePortion(index, { gramWeight: event.target.value })}
                    />
                    {errors[`portion-weight-${index}`] ? (
                      <span className="field__error">{errors[`portion-weight-${index}`]}</span>
                    ) : null}
                  </label>
                )}

                <label className="portion-row__default">
                  <input
                    type="radio"
                    name="defaultPortion"
                    checked={portion.isDefault}
                    onChange={() => updatePortion(index, { isDefault: true })}
                  />
                  {pl.fields.isDefault}
                </label>

                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => removePortion(index)}
                  disabled={portions.length === 1}
                >
                  {pl.actions.removePortion}
                </button>
              </li>
            )
          })}
        </ul>

        <button type="button" className="btn btn--secondary" onClick={addPortion}>
          {pl.actions.addPortion}
        </button>
      </section>

      <div className="product-form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting || Boolean(categoriesError)}>
          {submitting
            ? pl.actions.submitting
            : isEdit
              ? pl.actions.saveChanges
              : pl.actions.submit}
        </button>
        {isEdit ? (
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            {pl.actions.cancel}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={resetForm} disabled={submitting}>
            {pl.actions.reset}
          </button>
        )}
      </div>
    </form>
  )
}
