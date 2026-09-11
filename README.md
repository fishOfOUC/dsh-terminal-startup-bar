# dsh-terminal-startup-bar

A terminal startup status bar for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).

A booted `dsh` profile mounts dozens of plugin rows and loads them concurrently. On a cold start with a large composition that means the terminal sits silent for ten or twenty seconds with no way to tell whether anything is happening. This plugin turns that silence into one line:

```text
⠋ 正在加载 @deepseek-ai/cordis-plugin-timer…  3.2s  36/140
⠹ 正在加载 @deepseek-ai/dsh-session-projection-cache…  7.2s  130/142
⠸ 正在加载 @deepseek-ai/dsh-workspace…  8.3s  136/142
⠸ 正在加载 @daweifu/capability-menu/policy…  8.4s  141/142
✔ 启动完成 (8.7s)
```

The line names the plugin that has been outstanding longest, how long the boot has been running, and how many plugin rows are up. It is replaced by a completion line when the Loader settles, and it is erased — never left behind — on failure or teardown.

## Install

### As a bundle layer

The package ships `cordis.patch.yml`, so a profile can list it as a bundle. Install it into the profile and add the name to `dsh.profile.bundles` in `$DSH_HOME/profiles/<name>/package.json`:

```sh
dsh plugin --profile web add dsh-terminal-startup-bar
```

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-terminal-startup-bar"]
    }
  }
}
```

Bundle order is application order, so listing it last is enough — the row it inserts is an ordinary row with no dependencies, and it starts early regardless of where it sits in the list.

### As a row in a profile's own patch layer

If the package is already a dependency, add the row to `$DSH_HOME/profiles/<name>/cordis.patch.yml`:

```yaml
- insert:
    - id: terminal-startup-bar
      name: dsh-terminal-startup-bar
      config:
        label: Loading
```

### From a checkout, without installing

`--patch` overlays resolve a relative plugin name against the overlay file's directory, so a working tree can be mounted directly. [`examples/local.patch.yml`](examples/local.patch.yml) does exactly that:

```sh
dsh web --patch ./examples/local.patch.yml --port 3081
```

## Configuration

Every key is optional. An unknown key, or a value of the wrong type, throws at load with the key named rather than being ignored.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Keep the package installed but silent. |
| `stream` | `'stderr' \| 'stdout'` | `'stderr'` | Which standard stream the bar paints on. |
| `intervalMs` | integer ≥ 16 | `80` | Milliseconds between repaints. |
| `frames` | string[] | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Spinner frames, cycled in order. |
| `label` | string | `正在加载` | Text before the plugin being loaded. |
| `readyLabel` | string | `正在完成启动` | Text used once every plugin is active but the launcher has not committed readiness. |
| `doneLabel` | string | `启动完成` | Text on the closing line. |
| `showElapsed` | boolean | `true` | Show elapsed seconds. |
| `showProgress` | boolean | `true` | Show `done/total` plugin rows. |
| `showCompletion` | boolean | `true` | Print the closing line on a successful boot. |
| `force` | boolean | `false` | Paint even when the target stream is not a terminal. |

An English composition:

```yaml
- id: terminal-startup-bar
  config:
    label: Loading
    readyLabel: Finishing startup
    doneLabel: Ready
```

The bar writes nothing at all when its stream is not a TTY, unless `force` is set. That is what keeps spinner frames out of CI logs, captured output, and supervisor pipes.

## How it works

- **Where the numbers come from.** The plugin reads the Cordis Loader's entry tree through `ctx.get('loader')`. `total` counts enabled plugin rows; group rows, disabled rows, and nested-tree carriers (the root `cordis:include`, whose duration is the whole boot by construction) are excluded. `done` counts rows whose fiber reached the active state, and the named subject is the first row that has not, in composition order.
- **Why the subject is "longest outstanding".** The Loader mounts every row of a group with one `Promise.allSettled`, so rows start concurrently; there is no single row that is "the one loading". Naming the longest-outstanding row is the reading that stays truthful under that concurrency, and it advances as earlier rows finish.
- **Where the clock comes from.** `loader.envData.startTime` is stamped before the first profile row mounts, so elapsed time covers the whole boot. A missing, non-numeric, or future stamp falls back to the moment the row applied.
- **When it stops.** The Loader settling ends the load phase, which is before a surface such as the Web app prints its URL; the bar clears there so the URL line is never overwritten. The launcher's `appReady` signal is a second stop for compositions whose Loader settles differently. The row's own effect owns the repaint timer, so disposal — a failed boot, a signal, an HMR reload — always erases the line.
- **No dependencies.** The plugin is plain ESM with no runtime imports, not even `@deepseek-ai/cordis`: it reads the two facts it needs — the entry list and one fiber state — structurally. A loading indicator that pulls in its own module graph would be measuring a startup it slowed down.

## Known limitations

- **Another writer can collide with the line.** The bar repaints in place on the current terminal line. If some other plugin writes to the same terminal during a boot, the next repaint erases that text. `dsh` boots quietly in practice, and the bar stops at Loader settle — before the Web app prints its URL — but a row that logs during startup can still be clipped.
- **Rows waiting on a service are counted as loading.** A row whose fiber is pending on an injected service is reported as outstanding, exactly like a row still importing its module. The line says how far the boot got, not why a particular row is waiting.
- **The fiber state is read numerically.** `readProgress` compares against `FiberState.ACTIVE`'s numeric value rather than importing the enum, which is what keeps the plugin dependency-free. A future Cordis release that renumbers the enum would need this constant updated.

## Development

```sh
npm test      # node --test, no dependencies and no install step
```

The suite covers the pure formatter, the Loader tree reader, config validation, the bar's paint/erase lifecycle under an injected clock and timer, and the plugin's wiring against a context double.

## License

MIT
