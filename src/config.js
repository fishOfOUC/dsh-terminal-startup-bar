/**
 * Normalize and validate the row config.
 *
 * A profile's `cordis.yml` carries plain YAML, so every value arrives
 * unvalidated. A startup-bar mistake must not become a boot failure that is
 * hard to attribute, and it must not be silently ignored either: an unset key
 * takes its documented default, and a wrong one throws with the offending key.
 * @module dsh-terminal-startup-bar/config
 */

/** Spinner frames: ten Braille dots, the frames the startup display has always used. */
export const DEFAULT_FRAMES = Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'])

/** Shortest repaint period that stays under a typical 60 Hz frame. */
export const MIN_INTERVAL_MS = 16

/** Every accepted key with its default, in the order the README documents them. */
const DEFAULTS = Object.freeze({
  enabled: true,
  stream: 'stderr',
  intervalMs: 80,
  frames: DEFAULT_FRAMES,
  label: '正在加载',
  readyLabel: '正在完成启动',
  doneLabel: '启动完成',
  showElapsed: true,
  showProgress: true,
  showCompletion: true,
  force: false,
})

/**
 * @typedef {object} StartupBarOptions
 * @property {boolean} enabled - whether the bar paints at all.
 * @property {'stderr' | 'stdout'} stream - which standard stream to paint on.
 * @property {number} intervalMs - milliseconds between repaints.
 * @property {readonly string[]} frames - spinner frames, cycled in order.
 * @property {string} label - text before the name of the plugin being loaded.
 * @property {string} readyLabel - text used once every plugin is active but startup has not finished.
 * @property {string} doneLabel - text on the completion line.
 * @property {boolean} showElapsed - whether the line carries the elapsed seconds.
 * @property {boolean} showProgress - whether the line carries `done/total`.
 * @property {boolean} showCompletion - whether a successful startup prints a closing line.
 * @property {boolean} force - paint even when the target stream is not a terminal.
 */

/**
 * Validate one boolean key.
 * @param {unknown} value - the configured value.
 * @param {string} key - the key, named in the thrown error.
 * @returns {boolean} the validated value.
 * @throws when the value is present and not a boolean.
 */
function readBoolean(value, key) {
  if (typeof value !== 'boolean') throw new TypeError(`terminal-startup-bar: config "${key}" must be a boolean`)
  return value
}

/**
 * Validate one non-empty string key.
 * @param {unknown} value - the configured value.
 * @param {string} key - the key, named in the thrown error.
 * @returns {string} the validated value.
 * @throws when the value is present and not a non-empty string.
 */
function readText(value, key) {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`terminal-startup-bar: config "${key}" must be a non-empty string`)
  }
  return value
}

/**
 * Validate one repaint period.
 * @param {unknown} value - the configured value.
 * @returns {number} the validated period in milliseconds.
 * @throws when the value is not an integer at or above {@link MIN_INTERVAL_MS}.
 */
function readIntervalMs(value) {
  if (!Number.isInteger(value) || /** @type {number} */ (value) < MIN_INTERVAL_MS) {
    throw new TypeError(`terminal-startup-bar: config "intervalMs" must be an integer >= ${MIN_INTERVAL_MS}`)
  }
  return /** @type {number} */ (value)
}

/**
 * Validate the spinner frame list.
 * @param {unknown} value - the configured value.
 * @returns {readonly string[]} a frozen copy of the validated frames.
 * @throws when the value is not a non-empty array of non-empty strings.
 */
function readFrames(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('terminal-startup-bar: config "frames" must be a non-empty array of strings')
  }
  for (const frame of value) {
    if (typeof frame !== 'string' || frame === '') {
      throw new TypeError('terminal-startup-bar: config "frames" must be a non-empty array of strings')
    }
  }
  return Object.freeze([...value])
}

/**
 * Validate the target stream.
 * @param {unknown} value - the configured value.
 * @returns {'stderr' | 'stdout'} the validated stream name.
 * @throws when the value is neither `'stderr'` nor `'stdout'`.
 */
function readStream(value) {
  if (value !== 'stderr' && value !== 'stdout') {
    throw new TypeError('terminal-startup-bar: config "stream" must be "stderr" or "stdout"')
  }
  return value
}

/**
 * Apply defaults to the row config and reject an unknown key or a wrong value.
 * @param {unknown} raw - the row config from the composition; `undefined` means every default.
 * @returns {StartupBarOptions} the frozen options the bar runs with.
 * @throws when `raw` is not a mapping, names an unknown key, or carries an invalid value.
 */
export function normalizeConfig(raw) {
  if (raw === undefined || raw === null) return Object.freeze({ ...DEFAULTS })
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('terminal-startup-bar: config must be a mapping')
  }
  const source = /** @type {Record<string, unknown>} */ (raw)
  const unknown = Object.keys(source).filter(key => !Object.hasOwn(DEFAULTS, key))
  if (unknown.length > 0) {
    const known = Object.keys(DEFAULTS).join(', ')
    throw new TypeError(`terminal-startup-bar: unknown config key ${JSON.stringify(unknown[0])}; expected one of ${known}`)
  }
  return Object.freeze({
    enabled: source.enabled === undefined ? DEFAULTS.enabled : readBoolean(source.enabled, 'enabled'),
    stream: source.stream === undefined ? DEFAULTS.stream : readStream(source.stream),
    intervalMs: source.intervalMs === undefined ? DEFAULTS.intervalMs : readIntervalMs(source.intervalMs),
    frames: source.frames === undefined ? DEFAULTS.frames : readFrames(source.frames),
    label: source.label === undefined ? DEFAULTS.label : readText(source.label, 'label'),
    readyLabel: source.readyLabel === undefined ? DEFAULTS.readyLabel : readText(source.readyLabel, 'readyLabel'),
    doneLabel: source.doneLabel === undefined ? DEFAULTS.doneLabel : readText(source.doneLabel, 'doneLabel'),
    showElapsed: source.showElapsed === undefined ? DEFAULTS.showElapsed : readBoolean(source.showElapsed, 'showElapsed'),
    showProgress: source.showProgress === undefined ? DEFAULTS.showProgress : readBoolean(source.showProgress, 'showProgress'),
    showCompletion: source.showCompletion === undefined
      ? DEFAULTS.showCompletion
      : readBoolean(source.showCompletion, 'showCompletion'),
    force: source.force === undefined ? DEFAULTS.force : readBoolean(source.force, 'force'),
  })
}
