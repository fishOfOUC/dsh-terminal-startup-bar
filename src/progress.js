/**
 * Read startup progress out of the Cordis Loader's entry tree.
 *
 * The Loader is the only authority on what a profile mounts and how far each
 * row has gotten, so the bar observes it rather than instrumenting the
 * launcher. `@deepseek-ai/cordis` is a peer of every harness package, and the
 * bar deliberately has no runtime dependency on it: the two facts it needs
 * from that package — the entry list and one fiber state — are read
 * structurally, which keeps a loading indicator from adding its own module
 * graph to the startup it measures.
 * @module dsh-terminal-startup-bar/progress
 */

/** Numeric value of Cordis's `FiberState.ACTIVE`; see `vendor/cordis/src/fiber.ts`. */
const FIBER_ACTIVE = 2

/**
 * @typedef {object} LoaderEntry
 * @property {{ id?: string, name?: string, group?: unknown } | undefined} [options] - the configured row.
 * @property {{ state?: number } | undefined} [fiber] - the row's fiber, absent until its module finished importing.
 * @property {boolean} [disabled] - whether the row was disabled, so it never loads.
 * @property {unknown} [subtree] - present when this row is a tree carrier (`cordis:include`, a group).
 */

/**
 * @typedef {object} LoaderLike
 * @property {() => Iterable<LoaderEntry>} entries - every mounted row, including nested groups.
 * @property {{ startTime?: unknown } | undefined} [envData] - the Loader's per-process data.
 */

/**
 * @typedef {object} ProgressSnapshot
 * @property {number} total - enabled plugin rows currently mounted; group rows are excluded.
 * @property {number} done - rows whose fiber is active.
 * @property {string | undefined} current - name of the longest-outstanding row, or `undefined` when none is left.
 */

/**
 * Snapshot how far the mounted tree has gotten.
 *
 * Rows start concurrently, so the subject named here is the row that has been
 * outstanding longest rather than "the only thing loading"; it advances as
 * earlier rows reach the active state. Tree carriers — a row that owns a
 * nested entry tree, such as the root `cordis:include` — are excluded, because
 * their duration is the whole boot by construction and naming one would
 * freeze the line on it.
 * @param {LoaderLike} loader - the loader whose entry tree to read.
 * @returns {ProgressSnapshot} the current progress.
 */
export function readProgress(loader) {
  /** @type {ProgressSnapshot} */
  const snapshot = { total: 0, done: 0, current: undefined }
  for (const entry of loader.entries()) {
    const row = entry.options
    if (row === undefined || row.group) continue
    if (entry.disabled === true || entry.subtree !== undefined) continue
    snapshot.total += 1
    if (entry.fiber?.state === FIBER_ACTIVE) {
      snapshot.done += 1
      continue
    }
    if (snapshot.current === undefined) snapshot.current = row.name
  }
  return snapshot
}

/**
 * Read when this process's boot started.
 *
 * The Loader stamps `envData.startTime` before any profile row mounts, which
 * makes it the honest origin of the elapsed time. A missing, non-numeric, or
 * future stamp falls back to `fallback` so the bar can never render a
 * negative duration.
 * @param {LoaderLike | undefined} loader - the loader to read, when one is mounted.
 * @param {number} fallback - the timestamp to use when the Loader has no usable stamp.
 * @returns {number} the epoch-millisecond origin of the startup being displayed.
 */
export function readBootStart(loader, fallback) {
  const startTime = loader?.envData?.startTime
  return typeof startTime === 'number' && Number.isFinite(startTime) && startTime <= fallback
    ? startTime
    : fallback
}
