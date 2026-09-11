/**
 * @dsh/terminal-startup-bar — a terminal startup status bar for `dsh` profiles.
 *
 * A booted profile mounts dozens of plugin rows and loads them concurrently,
 * so a slow start looks like a frozen terminal. This row paints one line while
 * the tree loads:
 *
 * ```text
 * ⠹ 正在加载 capability-menu-policy…  18.4s  12/57
 * ```
 *
 * and replaces it with `✔ 启动完成 (18.4s)` once the Loader has settled. It
 * observes the Loader through `ctx.get('loader')` and the launcher's
 * readiness signal through `ctx.get('appReady')`, so it mounts as an ordinary
 * row anywhere in the composition — no launcher change and no injected
 * service is required.
 * @module dsh-terminal-startup-bar
 */

import { createStartupBar } from './bar.js'
import { normalizeConfig } from './config.js'
import { readBootStart } from './progress.js'

/** Stable Cordis plugin name; also the row id this plugin ships examples for. */
export const name = 'terminal-startup-bar'

/**
 * The slice of the Cordis context this row uses. Declared structurally rather
 * than imported so the package carries no runtime dependency; see the README.
 * @typedef {object} PluginContext
 * @property {(serviceName: string) => any} get - read a service from the global store.
 * @property {(execute: () => any, label?: string) => unknown} effect - register a cleanup-aware effect.
 */

/**
 * Paint the startup bar for the lifetime of this row.
 *
 * The bar contributes nothing outside a terminal: without a TTY (or an
 * explicit `force`) it registers no effect, no timer, and no listener, which
 * keeps captured logs and CI output free of spinner frames.
 * @param {PluginContext} ctx - this row's context.
 * @param {unknown} config - the row config; see {@link normalizeConfig} for every key.
 * @throws when the row config names an unknown key or carries an invalid value.
 */
export function apply(ctx, config) {
  const options = normalizeConfig(config)
  if (!options.enabled) return
  const stream = options.stream === 'stdout' ? process.stdout : process.stderr
  if (stream.isTTY !== true && !options.force) return

  const loader = ctx.get('loader')
  const ready = ctx.get('appReady')
  // Nothing to observe and nothing to wait for means there is no startup to display.
  if (loader === undefined && ready === undefined) return

  const bar = createStartupBar({
    stream,
    options,
    readLoader: () => ctx.get('loader'),
  })
  ctx.effect(() => {
    bar.start(readBootStart(loader, Date.now()))
    return () => bar.dispose()
  }, 'terminal-startup-bar')

  if (ready !== undefined) {
    ctx.effect(() => ready.onReady(() => bar.finish()), 'terminal-startup-bar-ready')
  }

  if (loader !== undefined) {
    // The Loader settles once every row has loaded, which is before a surface
    // such as the Web app prints its URL; clearing here leaves that line
    // intact. A rejected settle is a failed boot: erase the bar and let the
    // launcher's own diagnostic own the terminal.
    void loader.await().then(() => bar.finish(), () => bar.dispose())
  }
}
