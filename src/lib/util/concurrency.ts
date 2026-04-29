/**
 * Trevor — concurrency utilities
 *
 * Two tiny primitives keep the app responsive on large vaults and
 * crash-safe under fast typing:
 *
 *   • `pLimit(n)`   — caps the number of in-flight async tasks; everything
 *                     else queues. Prevents opening 1000 file handles when
 *                     loading large vaults.
 *   • `keyedMutex()` — serialises async work per key (e.g. per file path).
 *                      Eliminates write-after-read races where two saves
 *                      for the same note race and the older one wins.
 *
 * Both are dependency-free and zero-allocation in the steady state.
 */

/**
 * Build a function that runs at most `concurrency` async tasks at once.
 * Resolves with the underlying task's value or rejection, in order of
 * completion (NOT submission). Cheap, deterministic, and safe to use
 * across multiple unrelated jobs.
 */
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    if (queue.length > 0) queue.shift()!();
  };

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const exec = () => {
        active++;
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(next);
      };
      if (active < concurrency) exec();
      else queue.push(exec);
    });
  };
}

/**
 * Serialise async work per key. Useful for ensuring that two saves to
 * the same path can never overlap, while saves to different paths
 * still run in parallel.
 *
 *   const mutex = keyedMutex();
 *   await mutex(path, () => fs.writeFile(path, content));
 *
 * Each (key, callback) pair is enqueued as a microtask after the prior
 * task for that key resolves. The lock is released on success or error.
 */
export function keyedMutex() {
  const tails = new Map<string, Promise<unknown>>();

  return function lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn); // swallow prior rejection — keep the chain alive
    // Track the *settled* promise so newer queued work always chains after.
    const tracker = next.catch(() => {});
    tails.set(key, tracker);
    // GC entry only if no newer task replaced it.
    void tracker.then(() => {
      if (tails.get(key) === tracker) tails.delete(key);
    });
    return next as Promise<T>;
  };
}
