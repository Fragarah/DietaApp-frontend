import { useEffect, useState } from 'react'
import { pl } from '../../i18n/pl'
import { createPerson, deletePerson, fetchPersons, updatePerson } from './api'
import {
  createEmptyPersonDraft,
  personToDraft,
  type PersonDraft,
  type TargetMode,
  type TargetUnit,
  type UpsertPersonPayload,
} from './types'
import './PeoplePage.css'

function parsePositive(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) {
    return null
  }
  const num = Number(normalized)
  if (Number.isNaN(num) || num <= 0) {
    return null
  }
  return num
}

function buildPayload(draft: PersonDraft): UpsertPersonPayload | string {
  const name = draft.name.trim()
  if (!name) {
    return pl.people.errors.nameRequired
  }
  const dailyKcalLimit = parsePositive(draft.dailyKcalLimit)
  if (dailyKcalLimit == null) {
    return pl.people.errors.dailyLimitRequired
  }

  const mealTargets: UpsertPersonPayload['mealTargets'] = []
  for (const target of draft.mealTargets) {
    if (target.mode === 'FIXED') {
      const value = parsePositive(target.value)
      if (value == null) {
        return pl.people.errors.valueRequired
      }
      if (target.unit === 'PERCENT' && value > 100) {
        return pl.people.errors.percentTooHigh
      }
      mealTargets.push({
        mealCategory: target.mealCategory,
        unit: target.unit,
        mode: 'FIXED',
        value,
        minValue: null,
        maxValue: null,
      })
      continue
    }

    const minValue = parsePositive(target.minValue)
    const maxValue = parsePositive(target.maxValue)
    if (minValue == null || maxValue == null) {
      return pl.people.errors.rangeRequired
    }
    if (minValue > maxValue) {
      return pl.people.errors.rangeOrder
    }
    if (target.unit === 'PERCENT' && (minValue > 100 || maxValue > 100)) {
      return pl.people.errors.percentTooHigh
    }
    mealTargets.push({
      mealCategory: target.mealCategory,
      unit: target.unit,
      mode: 'RANGE',
      value: null,
      minValue,
      maxValue,
    })
  }

  return { name, dailyKcalLimit, mealTargets }
}

export function PeoplePage() {
  const [drafts, setDrafts] = useState<PersonDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [personToDelete, setPersonToDelete] = useState<PersonDraft | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const persons = await fetchPersons()
        if (!cancelled) {
          setDrafts(persons.map(personToDraft))
          setExpandedKeys(new Set())
        }
      } catch {
        if (!cancelled) {
          setLoadError(pl.people.errors.loadFailed)
          setDrafts([])
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

  function isExpanded(clientKey: string): boolean {
    return expandedKeys.has(clientKey)
  }

  function toggleExpanded(clientKey: string) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(clientKey)) {
        next.delete(clientKey)
      } else {
        next.add(clientKey)
      }
      return next
    })
  }

  function patchDraft(clientKey: string, patch: Partial<PersonDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.clientKey === clientKey
          ? { ...draft, ...patch, dirty: patch.dirty ?? true, success: null }
          : draft,
      ),
    )
  }

  function patchTarget(
    clientKey: string,
    mealCategory: PersonDraft['mealTargets'][number]['mealCategory'],
    patch: Partial<PersonDraft['mealTargets'][number]>,
  ) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.clientKey !== clientKey) {
          return draft
        }
        return {
          ...draft,
          dirty: true,
          success: null,
          mealTargets: draft.mealTargets.map((target) =>
            target.mealCategory === mealCategory ? { ...target, ...patch } : target,
          ),
        }
      }),
    )
  }

  function addPerson() {
    const draft = createEmptyPersonDraft()
    setDrafts((current) => [...current, draft])
    setExpandedKeys((current) => new Set(current).add(draft.clientKey))
  }

  async function savePerson(draft: PersonDraft) {
    const payload = buildPayload(draft)
    if (typeof payload === 'string') {
      patchDraft(draft.clientKey, { error: payload, dirty: true })
      return
    }

    patchDraft(draft.clientKey, { saving: true, error: null })
    try {
      const saved =
        draft.id == null
          ? await createPerson(payload)
          : await updatePerson(draft.id, payload)
      const next = personToDraft(saved)
      setDrafts((current) =>
        current.map((item) =>
          item.clientKey === draft.clientKey
            ? { ...next, success: draft.id == null ? pl.people.successCreated : pl.people.successSaved }
            : item,
        ),
      )
      setExpandedKeys((current) => {
        const nextKeys = new Set(current)
        if (nextKeys.delete(draft.clientKey)) {
          nextKeys.add(next.clientKey)
        }
        return nextKeys
      })
    } catch (err) {
      patchDraft(draft.clientKey, {
        saving: false,
        error: err instanceof Error ? err.message : pl.people.errors.saveFailed,
      })
    }
  }

  async function confirmDelete() {
    if (!personToDelete) {
      return
    }
    const draft = personToDelete
    setDeletingKey(draft.clientKey)
    try {
      if (draft.id != null) {
        await deletePerson(draft.id)
      }
      setDrafts((current) => current.filter((item) => item.clientKey !== draft.clientKey))
      setPersonToDelete(null)
    } catch (err) {
      patchDraft(draft.clientKey, {
        error: err instanceof Error ? err.message : pl.people.errors.deleteFailed,
      })
      setPersonToDelete(null)
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <section className="people-page">
      <header className="people-page__header">
        <p className="people-page__brand">{pl.appName}</p>
        <h1>{pl.people.title}</h1>
        <p className="people-page__subtitle">{pl.people.subtitle}</p>
      </header>

      {loading ? <p className="people-page__status">{pl.people.loading}</p> : null}
      {loadError ? (
        <p className="people-page__banner people-page__banner--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && drafts.length === 0 ? (
        <p className="people-page__status">{pl.people.empty}</p>
      ) : null}

      <ul className="people-list">
        {drafts.map((draft) => {
          const expanded = isExpanded(draft.clientKey)
          const displayName = draft.name.trim() || pl.people.unnamed
          const kcalLabel = pl.people.summaryKcal.replace(
            '{kcal}',
            draft.dailyKcalLimit.trim() || '—',
          )

          return (
            <li
              key={draft.clientKey}
              className={`person-card${expanded ? ' person-card--expanded' : ''}`}
            >
              <button
                type="button"
                className="person-card__summary"
                aria-expanded={expanded}
                onClick={() => toggleExpanded(draft.clientKey)}
              >
                <span className="person-card__summary-main">
                  <span className="person-card__summary-name">{displayName}</span>
                  <span className="person-card__summary-kcal">{kcalLabel}</span>
                </span>
                <span className="person-card__summary-meta">
                  {draft.dirty ? (
                    <span className="person-card__dirty">{pl.people.unsavedBadge}</span>
                  ) : null}
                  <span className="person-card__chevron" aria-hidden="true" />
                  <span className="person-card__summary-action">
                    {expanded ? pl.people.actions.collapse : pl.people.actions.expand}
                  </span>
                </span>
              </button>

              {expanded ? (
                <div className="person-card__body">
                  <div className="person-card__basics">
                    <label className="people-field">
                      <span>{pl.people.fields.name}</span>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) =>
                          patchDraft(draft.clientKey, { name: event.target.value })
                        }
                        placeholder={pl.people.placeholders.name}
                      />
                    </label>
                    <label className="people-field">
                      <span>{pl.people.fields.dailyLimit}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.dailyKcalLimit}
                        onChange={(event) =>
                          patchDraft(draft.clientKey, { dailyKcalLimit: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="person-card__meals">
                    <h2>{pl.people.mealsTitle}</h2>
                    <ul className="meal-target-list">
                      {draft.mealTargets.map((target) => (
                        <li key={target.mealCategory} className="meal-target-row">
                          <span className="meal-target-row__label">
                            {pl.meal.categories[target.mealCategory]}
                          </span>
                          <div className="meal-target-row__toggles" role="group">
                            <button
                              type="button"
                              className={`chip${target.unit === 'PERCENT' ? ' chip--active' : ''}`}
                              onClick={() =>
                                patchTarget(draft.clientKey, target.mealCategory, {
                                  unit: 'PERCENT' satisfies TargetUnit,
                                })
                              }
                            >
                              {pl.people.units.percent}
                            </button>
                            <button
                              type="button"
                              className={`chip${target.unit === 'KCAL' ? ' chip--active' : ''}`}
                              onClick={() =>
                                patchTarget(draft.clientKey, target.mealCategory, {
                                  unit: 'KCAL' satisfies TargetUnit,
                                })
                              }
                            >
                              {pl.people.units.kcal}
                            </button>
                            <button
                              type="button"
                              className={`chip${target.mode === 'FIXED' ? ' chip--active' : ''}`}
                              onClick={() =>
                                patchTarget(draft.clientKey, target.mealCategory, {
                                  mode: 'FIXED' satisfies TargetMode,
                                })
                              }
                            >
                              {pl.people.modes.fixed}
                            </button>
                            <button
                              type="button"
                              className={`chip${target.mode === 'RANGE' ? ' chip--active' : ''}`}
                              onClick={() =>
                                patchTarget(draft.clientKey, target.mealCategory, {
                                  mode: 'RANGE' satisfies TargetMode,
                                })
                              }
                            >
                              {pl.people.modes.range}
                            </button>
                          </div>
                          {target.mode === 'FIXED' ? (
                            <label className="people-field people-field--compact">
                              <span>{pl.people.fields.value}</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={target.value}
                                onChange={(event) =>
                                  patchTarget(draft.clientKey, target.mealCategory, {
                                    value: event.target.value,
                                  })
                                }
                              />
                            </label>
                          ) : (
                            <div className="meal-target-row__range">
                              <label className="people-field people-field--compact">
                                <span>{pl.people.fields.min}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={target.minValue}
                                  onChange={(event) =>
                                    patchTarget(draft.clientKey, target.mealCategory, {
                                      minValue: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="people-field people-field--compact">
                                <span>{pl.people.fields.max}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={target.maxValue}
                                  onChange={(event) =>
                                    patchTarget(draft.clientKey, target.mealCategory, {
                                      maxValue: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {draft.error ? (
                    <p className="people-page__banner people-page__banner--error" role="alert">
                      {draft.error}
                    </p>
                  ) : null}
                  {draft.success ? (
                    <p className="people-page__banner people-page__banner--success">
                      {draft.success}
                    </p>
                  ) : null}

                  <div className="person-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!draft.dirty || draft.saving}
                      onClick={() => void savePerson(draft)}
                    >
                      {draft.saving ? pl.people.actions.saving : pl.people.actions.save}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={draft.saving || deletingKey === draft.clientKey}
                      onClick={() => setPersonToDelete(draft)}
                    >
                      {pl.people.actions.delete}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn btn--secondary people-page__add" onClick={addPerson}>
        {pl.people.actions.add}
      </button>

      {personToDelete ? (
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={() => setPersonToDelete(null)}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-person-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-person-title">{pl.people.deleteConfirmTitle}</h2>
            <p>
              {pl.people.deleteConfirmMessage.replace(
                '{name}',
                personToDelete.name.trim() || pl.people.unnamed,
              )}
            </p>
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="btn btn--danger"
                disabled={deletingKey === personToDelete.clientKey}
                onClick={() => void confirmDelete()}
              >
                {deletingKey === personToDelete.clientKey
                  ? pl.people.actions.deleting
                  : pl.people.deleteConfirmYes}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setPersonToDelete(null)}>
                {pl.people.deleteConfirmNo}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
