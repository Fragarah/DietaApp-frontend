export type ResourceKey = 'meals' | 'products' | 'persons' | 'categories'

const TTL_MS = 5 * 60 * 1000
const STORAGE_PREFIX = 'dietaapp.cache.'

type CacheEntry<T> = {
  data: T
  at: number
}

const memory = new Map<ResourceKey, CacheEntry<unknown>>()
const inflight = new Map<ResourceKey, Promise<unknown>>()

function storageKey(key: ResourceKey): string {
  return `${STORAGE_PREFIX}${key}`
}

function readSession<T>(key: ResourceKey): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (!parsed || typeof parsed.at !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSession<T>(key: ResourceKey, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry))
  } catch {
    // quota / private mode — ignore
  }
}

function clearSession(key: ResourceKey): void {
  try {
    sessionStorage.removeItem(storageKey(key))
  } catch {
    // ignore
  }
}

function getEntry<T>(key: ResourceKey): CacheEntry<T> | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined
  if (mem) {
    return mem
  }
  const fromSession = readSession<T>(key)
  if (fromSession) {
    memory.set(key, fromSession)
    return fromSession
  }
  return null
}

function setEntry<T>(key: ResourceKey, data: T): void {
  const entry: CacheEntry<T> = { data, at: Date.now() }
  memory.set(key, entry)
  writeSession(key, entry)
}

export function peekResource<T>(key: ResourceKey): T | undefined {
  return getEntry<T>(key)?.data
}

export function invalidateResource(key?: ResourceKey): void {
  if (key) {
    memory.delete(key)
    inflight.delete(key)
    clearSession(key)
    return
  }
  for (const k of [...memory.keys()]) {
    memory.delete(k)
    clearSession(k)
  }
  inflight.clear()
}

/**
 * Stale-while-revalidate: świeży cache → bez sieci;
 * przeterminowany → od razu stale + revalidate w tle (onRevalidated);
 * brak → await fetcher.
 */
export async function getOrFetch<T>(
  key: ResourceKey,
  fetcher: () => Promise<T>,
  options?: {
    force?: boolean
    onRevalidated?: (data: T) => void
  },
): Promise<T> {
  const force = options?.force ?? false
  const entry = getEntry<T>(key)
  const fresh = entry != null && Date.now() - entry.at < TTL_MS

  if (!force && entry && fresh) {
    return entry.data
  }

  if (!force && entry && !fresh) {
    void runFetch(key, fetcher).then((data) => {
      options?.onRevalidated?.(data)
    })
    return entry.data
  }

  return runFetch(key, fetcher)
}

async function runFetch<T>(key: ResourceKey, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) {
    return existing
  }

  const pending = fetcher()
    .then((data) => {
      setEntry(key, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, pending)
  return pending
}
