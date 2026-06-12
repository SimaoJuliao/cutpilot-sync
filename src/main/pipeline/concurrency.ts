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
