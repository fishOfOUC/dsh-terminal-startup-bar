/**
 * Pure text formatting for the startup bar. Every function here depends only
 * on its arguments, so the bar's behavior is testable without a terminal.
 * @module dsh-terminal-startup-bar/format
 */

/** One tenth of a second, the resolution of the rendered elapsed time. */
const TENTH_SECOND_MS = 100

/** Suffix every dynamically rendered line carries before its trailing rule. */
const ELLIPSIS = '…'

/** @typedef {import('./config.js').StartupBarOptions} StartupBarOptions */
/** @typedef {import('./progress.js').ProgressSnapshot} ProgressSnapshot */

/**
 * Render a duration the way the startup line shows it.
 * @param {number} elapsedMs - elapsed milliseconds; a non-finite or negative value renders as `0.0s`.
 * @returns {string} the duration in tenths of a second, e.g. `'18.4s'`.
 */
export function formatElapsed(elapsedMs) {
  const safeMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  return `${(Math.round(safeMs / TENTH_SECOND_MS) / 10).toFixed(1)}s`
}

/**
 * Render one status line: spinner, what is loading, elapsed time, and progress.
 *
 * The subject falls back to `readyLabel` once every tracked plugin is active,
 * which is the window between the last plugin loading and the launcher
 * committing readiness.
 * @param {ProgressSnapshot} snapshot - progress at this tick.
 * @param {number} elapsedMs - milliseconds since boot started.
 * @param {number} tick - repaint counter; selects the spinner frame.
 * @param {StartupBarOptions} options - normalized plugin config.
 * @returns {string} the line without any terminal escape sequence or trailing newline.
 */
export function formatStatusLine(snapshot, elapsedMs, tick, options) {
  const frame = options.frames[tick % options.frames.length]
  const subject = snapshot.current
  // Three states share this line: a named row still loading, an empty tree
  // that has not mounted its first row yet, and a tree whose rows are all
  // active while the launcher finishes wiring what it booted.
  const text = subject !== undefined
    ? `${options.label} ${subject}${ELLIPSIS}`
    : `${snapshot.total === 0 ? options.label : options.readyLabel}${ELLIPSIS}`
  const parts = [`${frame} ${text}`]
  if (options.showElapsed) parts.push(formatElapsed(elapsedMs))
  if (options.showProgress && snapshot.total > 0) parts.push(`${snapshot.done}/${snapshot.total}`)
  return parts.join('  ')
}

/**
 * Render the line that closes a successful startup.
 * @param {StartupBarOptions} options - normalized plugin config.
 * @param {number} elapsedMs - total milliseconds the startup took.
 * @returns {string} the completion line, without a trailing newline.
 */
export function formatCompletionLine(options, elapsedMs) {
  return `✔ ${options.doneLabel} (${formatElapsed(elapsedMs)})`
}
