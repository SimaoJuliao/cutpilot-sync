/**
 * concurrency.ts
 * Small generic concurrency primitives (no domain logic).
 */

/**
 * Run `worker` over `items` with at most `limit` concurrent executions.
 * Items are pulled in order; the first worker error stops the pool from
 * starting new items and is re-thrown once in-flight work settles.
 */
export const runPool = async <T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  let next = 0
  let failure: unknown = null
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      if (failure) return
      const i = next++
      if (i >= items.length) return
      try {
        await worker(items[i], i)
      } catch (e) {
        failure = e
        return
      }
    }
  })
  await Promise.all(runners)
  if (failure) throw failure
}

/** Work already running, keyed by whatever identifies the result. */
const inFlight = new Map<string, Promise<unknown>>()

/**
 * Run `fn` once per `key`, sharing the result with every caller that asks while
 * it is still running.
 *
 * Needed wherever an expensive job writes to a fixed destination: React
 * StrictMode fires effects twice in development, and a user can trigger the same
 * job twice by clicking quickly, so without this two ffmpeg processes end up
 * writing one file. The entry is dropped when the promise settles, so a failure
 * is not cached — the next caller retries.
 */
export const singleFlight = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const running = inFlight.get(key) as Promise<T> | undefined
  if (running) return running

  const task = fn()
  inFlight.set(key, task)
  return task.finally(() => inFlight.delete(key))
}
