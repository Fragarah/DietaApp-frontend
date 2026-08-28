import { useEffect, useMemo, useRef, useState } from 'react'
import { pl } from '../../i18n/pl'
import { formatCountableUnit } from '../../i18n/plCount'
import { fetchMeals } from '../meals/api'
import { MEAL_CATEGORIES, type MealCategory, type MealResponse } from '../meals/types'
import { fetchPersons } from '../people/api'
import type { PersonResponse } from '../people/types'
import { fetchProducts } from '../products/api'
import {
  getDefaultPortion,
  isCountableUnit,
  type ProductResponse,
} from '../products/types'
import { buildPersonColumn, computePortionsForPeople } from './portionMath'
import './PortionsBoard.css'

function formatNumber(value: number): string {
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

/** Odchylenie kcal od celu: ≤5% ok, ≤10% ostrzeżenie, inaczej poza zakresem. */
function kcalAccuracyTone(
  actualKcal: number,
  targetKcal: string,
): 'ok' | 'warn' | 'bad' | null {
  const target = Number(String(targetKcal).replace(',', '.'))
  if (!(target > 0) || Number.isNaN(actualKcal)) {
    return null
  }
  const pct = (Math.abs(actualKcal - target) / target) * 100
  if (pct <= 5) {
    return 'ok'
  }
  if (pct <= 10) {
    return 'warn'
  }
  return 'bad'
}

export function PortionsBoard() {
  const [meals, setMeals] = useState<MealResponse[]>([])
  const [savedPeople, setSavedPeople] = useState<PersonResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mealQuery, setMealQuery] = useState('')
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<Set<MealCategory>>(new Set())
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([])
  const [peoplePanelOpen, setPeoplePanelOpen] = useState(true)
  const mealPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [mealData, peopleData, productData] = await Promise.all([
          fetchMeals(),
          fetchPersons(),
          fetchProducts(),
        ])
        if (!cancelled) {
          setMeals(
            [...mealData].sort((a, b) =>
              a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }),
            ),
          )
          const people = [...peopleData].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
          setSavedPeople(people)
          setSelectedPersonIds(people.map((person) => person.id))
          setProducts(productData)
        }
      } catch {
        if (!cancelled) {
          setError(pl.portions.errors.loadFailed)
          setMeals([])
          setSavedPeople([])
          setSelectedPersonIds([])
          setProducts([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (mealPickerRef.current?.contains(target)) {
        return
      }
      setPickerOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  const selectedMeal = useMemo(
    () => meals.find((meal) => meal.id === selectedMealId) ?? null,
    [meals, selectedMealId],
  )

  const isWhole = selectedMeal?.mealType === 'WHOLE'

  const personColumns = useMemo(() => {
    const mealCategory = selectedMeal?.mealCategory ?? null
    return selectedPersonIds
      .map((id) => savedPeople.find((person) => person.id === id))
      .filter((person): person is PersonResponse => person != null)
      .map((person) => buildPersonColumn(person, mealCategory))
  }, [savedPeople, selectedPersonIds, selectedMeal])

  const selectedPeopleDailyTotal = useMemo(
    () => personColumns.reduce((sum, person) => sum + person.dailyKcalLimit, 0),
    [personColumns],
  )

  const productById = useMemo(() => {
    const map = new Map<number, ProductResponse>()
    for (const product of products) {
      map.set(product.id, product)
    }
    return map
  }, [products])

  const portionsByPersonId = useMemo(() => {
    if (!selectedMeal || personColumns.length === 0) {
      return new Map()
    }
    return computePortionsForPeople(
      selectedMeal,
      personColumns,
      selectedPeopleDailyTotal,
      productById,
    )
  }, [selectedMeal, personColumns, selectedPeopleDailyTotal, productById])

  const prepMassTotals = useMemo(() => {
    const byIngredient = new Map<
      number,
      {
        productName: string
        grams: number
        pieces: number | null
        pieceUnit: string | null
        sortKey: number
      }
    >()
    let totalGrams = 0

    for (const person of personColumns) {
      const portion = portionsByPersonId.get(person.personId)
      if (!portion) {
        continue
      }
      portion.lines.forEach((line, index) => {
        totalGrams += line.quantityGrams
        const product = productById.get(line.productId)
        const defaultPortion = product ? getDefaultPortion(product) : null
        const countable =
          isCountableUnit(line.baseUnit) ||
          Boolean(
            defaultPortion &&
              isCountableUnit(defaultPortion.unitName) &&
              defaultPortion.gramWeight > 0,
          )
        const pieceUnit = countable
          ? isCountableUnit(line.baseUnit)
            ? line.baseUnit
            : (defaultPortion?.unitName ?? null)
          : null
        const linePieces = countable
          ? isCountableUnit(line.baseUnit)
            ? line.quantityBase
            : defaultPortion && defaultPortion.gramWeight > 0
              ? line.quantityGrams / defaultPortion.gramWeight
              : null
          : null

        const current = byIngredient.get(line.productId)
        if (current) {
          current.grams += line.quantityGrams
          if (current.pieces != null && linePieces != null) {
            current.pieces += linePieces
          }
        } else {
          byIngredient.set(line.productId, {
            productName: line.productName,
            grams: line.quantityGrams,
            pieces: linePieces,
            pieceUnit,
            sortKey: line.mealIngredientId || index,
          })
        }
      })
    }

    const ingredients = [...byIngredient.values()].sort((a, b) => a.sortKey - b.sortKey)
    return { totalGrams, ingredients }
  }, [personColumns, portionsByPersonId, productById])

  const filteredMeals = useMemo(() => {
    const needle = mealQuery.trim().toLocaleLowerCase('pl-PL')
    return meals
      .filter((meal) => {
        if (categoryFilters.size > 0 && !categoryFilters.has(meal.mealCategory)) {
          return false
        }
        if (!needle) {
          return true
        }
        return meal.name.toLocaleLowerCase('pl-PL').includes(needle)
      })
      .slice(0, 12)
  }, [meals, mealQuery, categoryFilters])

  const peopleSummary = useMemo(() => {
    if (personColumns.length === 0) {
      return pl.portions.peoplePanel.noneSelected
    }
    const countLabel =
      personColumns.length === 1
        ? pl.portions.peoplePanel.onePerson
        : pl.portions.peoplePanel.manyPersons.replace(
            '{count}',
            String(personColumns.length),
          )
    const names = personColumns.map((person) => person.label).join(', ')
    return `${countLabel} · ${names}`
  }, [personColumns])

  function togglePerson(personId: number) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    )
  }

  function toggleCategory(category: MealCategory) {
    setCategoryFilters((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
    setPickerOpen(true)
  }

  function chooseMeal(meal: MealResponse) {
    setSelectedMealId(meal.id)
    setMealQuery(meal.name)
    setPickerOpen(false)
  }

  return (
    <section className="portions-board">
      <header className="portions-board__header">
        <p className="portions-board__brand">{pl.appName}</p>
        <h1>{pl.portions.title}</h1>
      </header>

      {error ? (
        <p className="portions-board__banner portions-board__banner--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="people-panel" aria-labelledby="people-panel-title">
        {peoplePanelOpen ? (
          <>
            <div className="people-panel__bar">
              <h2 id="people-panel-title">{pl.portions.peoplePanel.title}</h2>
              <button
                type="button"
                className="btn btn--collapse"
                onClick={() => setPeoplePanelOpen(false)}
              >
                {pl.portions.peoplePanel.collapse}
              </button>
            </div>
            <p className="people-panel__hint">{pl.portions.peoplePanel.hint}</p>

            {loading ? (
              <p className="people-panel__status">{pl.portions.loadingPeople}</p>
            ) : null}

            {!loading && savedPeople.length === 0 ? (
              <p className="people-panel__status">{pl.portions.peoplePanel.empty}</p>
            ) : null}

            {!loading && savedPeople.length > 0 ? (
              <ul className="people-panel__picks" role="list">
                {savedPeople.map((person) => {
                  const active = selectedPersonIds.includes(person.id)
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        className={`people-pick${active ? ' people-pick--active' : ''}`}
                        aria-pressed={active}
                        onClick={() => togglePerson(person.id)}
                      >
                        <span className="people-pick__name">{person.name}</span>
                        <span className="people-pick__hint">
                          {pl.portions.peoplePanel.dailyLimitHint.replace(
                            '{kcal}',
                            String(person.dailyKcalLimit),
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="people-panel__collapsed"
            onClick={() => setPeoplePanelOpen(true)}
            aria-expanded={false}
            aria-label={pl.portions.peoplePanel.expand}
          >
            <span id="people-panel-title">{pl.portions.peoplePanel.title}</span>
            <span className="people-panel__collapsed-meta">{peopleSummary}</span>
          </button>
        )}
      </section>

      <section className="portions-meal-section">
        <label className="portions-field portions-field--meal">
          <span>{pl.portions.fields.meal}</span>
          <div className="portions-meal-picker" ref={mealPickerRef}>
            <input
              type="search"
              value={mealQuery}
              disabled={loading || Boolean(error)}
              placeholder={
                loading ? pl.portions.loadingMeals : pl.portions.placeholders.mealSearch
              }
              onChange={(event) => {
                setMealQuery(event.target.value)
                setPickerOpen(true)
                if (selectedMeal && event.target.value !== selectedMeal.name) {
                  setSelectedMealId(null)
                }
              }}
              onFocus={() => setPickerOpen(true)}
            />
            {pickerOpen && !loading && !error ? (
              <ul className="portions-meal-picker__list" role="listbox">
                {filteredMeals.length === 0 ? (
                  <li className="portions-meal-picker__empty">
                    {pl.portions.errors.noMealMatches}
                  </li>
                ) : (
                  filteredMeals.map((meal) => (
                    <li key={meal.id}>
                      <button type="button" onMouseDown={() => chooseMeal(meal)}>
                        <span>{meal.name}</span>
                        <span className="portions-meal-picker__meta">
                          {pl.meal.categories[meal.mealCategory]} · {pl.meal.types[meal.mealType]}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </label>

        <div
          className="portions-category-tags"
          role="group"
          aria-label={pl.portions.fields.categoryFilters}
        >
          {MEAL_CATEGORIES.map((category) => {
            const active = categoryFilters.has(category)
            return (
              <button
                key={category}
                type="button"
                className={`portions-tag${active ? ' portions-tag--active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
              >
                {pl.meal.categories[category]}
              </button>
            )
          })}
        </div>
      </section>

      {!selectedMeal ? (
        <p className="portions-board__status">{pl.portions.hints.pickMeal}</p>
      ) : personColumns.length === 0 ? (
        <p className="portions-board__status">{pl.portions.hints.selectPeople}</p>
      ) : (
        <>
          <p className="portions-board__meta">
            {pl.meal.types[selectedMeal.mealType]} · {formatNumber(selectedMeal.recipeCalories)}{' '}
            {pl.portions.summary.recipeKcal}
            {isWhole ? (
              <>
                {' '}
                · {pl.portions.summary.plannedDays.replace(
                  '{days}',
                  String(selectedMeal.plannedDays ?? 1),
                )}
                {' '}
                · {pl.portions.summary.sharePool} {formatNumber(selectedPeopleDailyTotal)} kcal
              </>
            ) : null}
          </p>

          <div className="portions-layout">
            <aside className="portions-totals-rail" aria-label={pl.portions.summary.prepTotals}>
              <h3>{pl.portions.summary.prepTotals}</h3>
              <ul className="portions-totals-rail__list">
                <li className="portions-totals-rail__list--total">
                  <span className="portions-totals-rail__name">
                    {pl.portions.summary.totalMass}
                  </span>
                  <span className="portions-totals-rail__mass">
                    {formatNumber(prepMassTotals.totalGrams)} {pl.meal.summary.grams}
                  </span>
                </li>
                {prepMassTotals.ingredients.map((item) => (
                  <li key={item.productName + item.sortKey}>
                    <span className="portions-totals-rail__name">{item.productName}</span>
                    <span className="portions-totals-rail__mass">
                      {item.pieces != null && item.pieceUnit
                        ? `${formatNumber(item.pieces)} ${formatCountableUnit(item.pieceUnit, item.pieces)} (${formatNumber(item.grams)} ${pl.meal.summary.grams})`
                        : `${formatNumber(item.grams)} ${pl.meal.summary.grams}`}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="portions-columns">
            {personColumns.map((person) => {
              const portion = portionsByPersonId.get(person.personId) ?? null
              const kcalTone = portion
                ? kcalAccuracyTone(portion.totals.calories, person.targetKcal)
                : null
              const totalMassGrams = portion
                ? portion.lines.reduce((sum, line) => sum + line.quantityGrams, 0)
                : 0

              return (
                <article key={person.id} className="portion-column">
                  <header className="portion-column__title">
                    <h3>{person.label}</h3>
                    <p className="portion-column__daily">
                      {pl.portions.peoplePanel.dailyLimitHint.replace(
                        '{kcal}',
                        String(person.dailyKcalLimit),
                      )}
                      {' · '}
                      {person.targetKcal
                        ? pl.portions.peoplePanel.mealSlotTarget
                            .replace(
                              '{category}',
                              pl.meal.categories[selectedMeal.mealCategory],
                            )
                            .replace('{kcal}', formatNumber(Number(person.targetKcal)))
                        : pl.portions.peoplePanel.mealSlotTargetMissing.replace(
                            '{category}',
                            pl.meal.categories[selectedMeal.mealCategory],
                          )}
                    </p>
                    {portion ? (
                      <p
                        className={
                          kcalTone
                            ? `portion-column__computed portion-column__computed--${kcalTone}`
                            : 'portion-column__computed'
                        }
                      >
                        {pl.portions.summary.fromTemplate}: {formatNumber(portion.totals.calories)}{' '}
                        kcal
                        {portion.sharePercent != null
                          ? ` · ${formatNumber(portion.sharePercent)}%`
                          : ''}
                      </p>
                    ) : null}
                  </header>

                  {!portion ? (
                    <p className="portion-column__hint">
                      {isWhole
                        ? pl.portions.hints.missingDailyLimit
                        : pl.portions.hints.missingMealTarget}
                    </p>
                  ) : (
                    <>
                      <dl className="portion-column__totals">
                        <div>
                          <dt>{pl.portions.summary.calories}</dt>
                          <dd>{formatNumber(portion.totals.calories)}</dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.protein}</dt>
                          <dd>
                            {formatNumber(portion.totals.protein)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.carbs}</dt>
                          <dd>
                            {formatNumber(portion.totals.carbs)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                        <div>
                          <dt>{pl.portions.summary.fat}</dt>
                          <dd>
                            {formatNumber(portion.totals.fat)} {pl.meal.summary.grams}
                          </dd>
                        </div>
                      </dl>

                      <ul className="portion-column__lines">
                        <li className="portion-line portion-line--total">
                          <div className="portion-line__mass">
                            {formatNumber(totalMassGrams)} {pl.meal.summary.grams}
                          </div>
                          <div className="portion-line__body">
                            <div className="portion-line__title">
                              <strong>{pl.portions.summary.totalMass}</strong>
                            </div>
                          </div>
                        </li>
                        {portion.lines.map((line) => (
                          <li key={line.mealIngredientId} className="portion-line">
                            <div className="portion-line__mass">
                              {formatNumber(line.quantityGrams)} {pl.meal.summary.grams}
                            </div>
                            <div className="portion-line__body">
                              <div className="portion-line__title">
                                <strong>{line.productName}</strong>
                              </div>
                              {line.baseUnit !== 'g' && line.baseUnit !== 'ml' ? (
                                <div className="portion-line__qty">
                                  {formatNumber(line.quantityBase)}{' '}
                                  {formatCountableUnit(line.baseUnit, line.quantityBase)}
                                </div>
                              ) : null}
                              <div className="portion-line__macros">
                                {formatNumber(line.calories)} kcal ·{' '}
                                {formatNumber(line.protein)}/{formatNumber(line.carbs)}/
                                {formatNumber(line.fat)} {pl.meal.summary.grams}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>
              )
            })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
