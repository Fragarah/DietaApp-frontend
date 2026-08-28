/** Polskie formy: 1 sztuka, 2–4 sztuki, 5+ / 12–14 sztuk (oraz analogicznie opakowanie). */

type CountForms = {
  one: string
  few: string
  many: string
}

const COUNTABLE_FORMS: Record<string, CountForms> = {
  sztuka: { one: 'sztuka', few: 'sztuki', many: 'sztuk' },
  opakowanie: { one: 'opakowanie', few: 'opakowania', many: 'opakowań' },
}

/**
 * Odmiana rzeczownika liczonego po polsku.
 * Dla wartości niecałkowitych → forma „many” (np. 1,5 sztuk).
 */
export function polishCountNoun(count: number, forms: CountForms): string {
  if (!Number.isFinite(count)) {
    return forms.many
  }
  if (!Number.isInteger(count)) {
    return forms.many
  }

  const n = Math.abs(count)
  const mod10 = n % 10
  const mod100 = n % 100

  if (n === 1) {
    return forms.one
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms.few
  }
  return forms.many
}

/** Odmienia znaną jednostkę porcji; nieznane nazwy zwraca bez zmian. */
export function formatCountableUnit(unitName: string, count: number): string {
  const forms = COUNTABLE_FORMS[unitName]
  if (!forms) {
    return unitName
  }
  return polishCountNoun(count, forms)
}

/** Forma słownikowa (bez liczby) — etykiety w formularzach. */
export function countableUnitLabel(unitName: string): string {
  return COUNTABLE_FORMS[unitName]?.one ?? unitName
}
