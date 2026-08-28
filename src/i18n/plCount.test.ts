import { describe, expect, it } from 'vitest'
import { formatCountableUnit, polishCountNoun } from './plCount'

const sztuka = { one: 'sztuka', few: 'sztuki', many: 'sztuk' }

describe('polishCountNoun', () => {
  it('declines sztuka for typical counts', () => {
    expect(polishCountNoun(1, sztuka)).toBe('sztuka')
    expect(polishCountNoun(2, sztuka)).toBe('sztuki')
    expect(polishCountNoun(3, sztuka)).toBe('sztuki')
    expect(polishCountNoun(4, sztuka)).toBe('sztuki')
    expect(polishCountNoun(5, sztuka)).toBe('sztuk')
    expect(polishCountNoun(11, sztuka)).toBe('sztuk')
    expect(polishCountNoun(12, sztuka)).toBe('sztuk')
    expect(polishCountNoun(14, sztuka)).toBe('sztuk')
    expect(polishCountNoun(22, sztuka)).toBe('sztuki')
    expect(polishCountNoun(25, sztuka)).toBe('sztuk')
  })

  it('uses many form for fractions', () => {
    expect(polishCountNoun(1.5, sztuka)).toBe('sztuk')
  })
})

describe('formatCountableUnit', () => {
  it('formats sztuka and opakowanie', () => {
    expect(formatCountableUnit('sztuka', 1)).toBe('sztuka')
    expect(formatCountableUnit('sztuka', 2)).toBe('sztuki')
    expect(formatCountableUnit('opakowanie', 1)).toBe('opakowanie')
    expect(formatCountableUnit('opakowanie', 2)).toBe('opakowania')
    expect(formatCountableUnit('opakowanie', 5)).toBe('opakowań')
  })
})
