type Listener = (visible: boolean) => void

const SLOW_MS = 3000

let pendingSlow = 0
const listeners = new Set<Listener>()

function notify(): void {
  const visible = pendingSlow > 0
  for (const listener of listeners) {
    listener(visible)
  }
}

export function subscribeServerWake(listener: Listener): () => void {
  listeners.add(listener)
  listener(pendingSlow > 0)
  return () => {
    listeners.delete(listener)
  }
}

/** Opakowuje Promise: po 3 s sygnalizuje „budzenie serwera”. */
export async function withServerWake<T>(promise: Promise<T>): Promise<T> {
  let marked = false
  const timer = window.setTimeout(() => {
    marked = true
    pendingSlow += 1
    notify()
  }, SLOW_MS)

  try {
    return await promise
  } finally {
    window.clearTimeout(timer)
    if (marked) {
      pendingSlow = Math.max(0, pendingSlow - 1)
      notify()
    }
  }
}
