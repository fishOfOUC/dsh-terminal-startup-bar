/**
 * Own the terminal line the startup bar paints.
 *
 * The bar never adds lines during startup: it keeps one line erased and
 * repainted so a long boot stays readable, and it leaves the terminal exactly
 * as it found it whenever it stops — on success, on failure, or on disposal.
 * @module dsh-terminal-startup-bar/bar
 */

import { formatCompletionLine, formatStatusLine } from './format.js'
import { readProgress } from './progress.js'

/** Return the cursor to column 0 and erase the line it was on. */
export const ERASE_LINE = '\r\x1b[K'

/** @typedef {import('./config.js').StartupBarOptions} StartupBarOptions */
/** @typedef {import('./progress.js').LoaderLike} LoaderLike */
/** @typedef {import('./progress.js').ProgressSnapshot} ProgressSnapshot */

/**
 * The timer functions the bar schedules repaints with. The handle is
 * deliberately `any`: it is opaque to the bar, and typing it would force every
 * clock double in a test to return the host's own timer type.
 * @typedef {object} TimerHost
 * @property {(callback: () => void, ms: number) => any} setInterval - schedule a repeating callback.
 * @property {(handle: any) => void} clearInterval - cancel a handle from {@link TimerHost.setInterval}.
 */

/**
 * @typedef {object} StartupBar
 * @property {(bootStart: number) => void} start - paint the first frame and schedule repaints.
 * @property {() => void} finish - stop, erase the line, and report a successful startup.
 * @property {() => void} dispose - stop and erase the line, reporting nothing.
 */

/**
 * Create the startup bar.
 * @param {object} deps - the bar's collaborators.
 * @param {{ write(chunk: string): unknown }} deps.stream - the stream the bar paints on.
 * @param {StartupBarOptions} deps.options - normalized plugin config.
 * @param {() => LoaderLike | undefined} deps.readLoader - read the Loader, which may disappear during teardown.
 * @param {() => number} [deps.now] - clock, injectable so tests control elapsed time.
 * @param {TimerHost} [deps.timers] - timer functions, injectable for tests.
 * @returns {StartupBar} the bar.
 */
export function createStartupBar({ stream, options, readLoader, now = Date.now, timers = { setInterval, clearInterval } }) {
  /** @type {any} */
  let handle
  let tick = 0
  let startedAt = 0
  let halted = false
  let painted = false
  /** @type {ProgressSnapshot} */
  let snapshot = { total: 0, done: 0, current: undefined }

  /**
   * Read progress and repaint the line in place. A Loader that already went
   * away keeps the previous snapshot: repainting the boot that just ended is
   * more truthful than blanking the line.
   */
  function repaint() {
    const loader = readLoader()
    if (loader !== undefined) snapshot = readProgress(loader)
    stream.write(ERASE_LINE + formatStatusLine(snapshot, now() - startedAt, tick, options))
    painted = true
    tick += 1
  }

  /** Stop repainting and erase the bar's line; no-op once the bar has stopped. */
  function halt() {
    if (halted) return false
    halted = true
    if (handle !== undefined) timers.clearInterval(handle)
    handle = undefined
    if (painted) {
      stream.write(ERASE_LINE)
      painted = false
    }
    return true
  }

  return {
    start(bootStart) {
      if (halted) return
      startedAt = bootStart
      repaint()
      handle = timers.setInterval(repaint, options.intervalMs)
    },
    finish() {
      if (!halt()) return
      if (options.showCompletion) stream.write(formatCompletionLine(options, now() - startedAt) + '\n')
    },
    dispose() {
      halt()
    },
  }
}
