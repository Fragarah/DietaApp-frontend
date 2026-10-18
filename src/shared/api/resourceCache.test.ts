import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrFetch, invalidateResource, peekResource } from './resourceCache'

describe('resourceCache', () => {
  beforeEach(() => {
    invalidateResource()
    sessionStorage.clear()
  })

  it('returns fresh cache without calling fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2])
    await getOrFetch('products', fetcher)
    const second = await getOrFetch('products', fetcher)
    expect(second).toEqual([1, 2])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('force bypasses cache', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(['a'])
      .mockResolvedValueOnce(['b'])
    await getOrFetch('meals', fetcher)
    const forced = await getOrFetch('meals', fetcher, { force: true })
    expect(forced).toEqual(['b'])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate clears peek', async () => {
    await getOrFetch('persons', async () => [{ id: 1 }])
    expect(peekResource('persons')).toEqual([{ id: 1 }])
    invalidateResource('persons')
    expect(peekResource('persons')).toBeUndefined()
  })
})
