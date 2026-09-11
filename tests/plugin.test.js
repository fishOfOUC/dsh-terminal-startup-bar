import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply, name } from '../src/index.js'

/**
 * Build a context double that runs effects eagerly, the way Cordis does.
 * @param {Record<string, unknown>} services - the service values `ctx.get` returns.
 * @returns the double, with its registered effect records.
 */
function createFakeContext(services) {
  const effects = []
  return {
    effects,
    get: serviceName => services[serviceName],
    effect(execute, label) {
      const disposer = execute()
      const record = { label, dispose: () => disposer?.() }
      effects.push(record)
      return () => record.dispose()
    },
  }
}

/**
 * Build a loader double whose settle promise the test controls.
 * @param {object[]} entries - the rows `loader.entries()` yields.
 * @returns the double plus its `settle` and `fail` controls.
 */
function createFakeLoader(entries) {
  let settle
  let fail
  const awaited = new Promise((resolve, reject) => {
    settle = resolve
    fail = reject
  })
  return {
    envData: { startTime: Date.now() },
    entries: () => entries,
    await: () => awaited,
    settle,
    fail,
  }
}

/** Capture everything the plugin writes to `process.stderr` for the duration of `body`. */
async function withCapturedStderr(body) {
  const original = process.stderr.write
  const chunks = []
  process.stderr.write = chunk => {
    chunks.push(String(chunk))
    return true
  }
  try {
    await body(chunks)
  } finally {
    process.stderr.write = original
  }
}

/** Dispose every effect a test registered, so no repaint timer outlives it. */
function disposeAll(ctx) {
  for (const effect of ctx.effects) effect.dispose()
}

test('the plugin declares the row id its bundle patch inserts', () => {
  assert.equal(name, 'terminal-startup-bar')
})

test('apply paints nothing when the row is disabled', () => {
  const ctx = createFakeContext({ loader: createFakeLoader([]) })
  apply(ctx, { enabled: false, force: true })
  assert.deepEqual(ctx.effects, [])
})

test('apply paints nothing without a terminal', () => {
  const ctx = createFakeContext({ loader: createFakeLoader([]) })
  apply(ctx, {})
  assert.deepEqual(ctx.effects, [])
})

test('apply paints nothing when there is neither a loader nor a readiness signal', () => {
  const ctx = createFakeContext({})
  apply(ctx, { force: true })
  assert.deepEqual(ctx.effects, [])
})

test('apply paints the loading line and closes it when the loader settles', async () => {
  const loader = createFakeLoader([
    { options: { id: 'a', name: 'a' }, fiber: { state: 2 } },
    { options: { id: 'b', name: 'capability-menu-policy' } },
  ])
  const ctx = createFakeContext({ loader })
  await withCapturedStderr(async (chunks) => {
    apply(ctx, { force: true, intervalMs: 20 })
    assert.deepEqual(ctx.effects.map(effect => effect.label), ['terminal-startup-bar'])
    assert.match(chunks[0], /⠋ 正在加载 capability-menu-policy…  \d+\.\ds  1\/2$/)
    loader.settle()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(chunks[1], '\r\x1b[K')
    assert.match(chunks[2], /^✔ 启动完成 \(\d+\.\ds\)\n$/)
  })
  disposeAll(ctx)
})

test('apply closes the bar at the launcher readiness signal', async () => {
  let ready
  const readyService = { onReady: listener => { ready = listener; return () => { ready = undefined } } }
  const ctx = createFakeContext({ appReady: readyService })
  await withCapturedStderr(async (chunks) => {
    apply(ctx, { force: true })
    assert.deepEqual(ctx.effects.map(effect => effect.label), ['terminal-startup-bar', 'terminal-startup-bar-ready'])
    ready()
    assert.equal(chunks[1], '\r\x1b[K')
    assert.match(chunks[2], /^✔ 启动完成 \(\d+\.\ds\)\n$/)
  })
  disposeAll(ctx)
})

test('apply erases the bar without a closing line when the loader rejects', async () => {
  const loader = createFakeLoader([])
  const ctx = createFakeContext({ loader })
  await withCapturedStderr(async (chunks) => {
    apply(ctx, { force: true })
    loader.fail(new Error('boot failed'))
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(chunks.slice(1), ['\r\x1b[K'])
  })
  disposeAll(ctx)
})

test('disposing the row erases the bar', async () => {
  const ctx = createFakeContext({ loader: createFakeLoader([]) })
  await withCapturedStderr(async (chunks) => {
    apply(ctx, { force: true })
    disposeAll(ctx)
    assert.deepEqual(chunks.slice(1), ['\r\x1b[K'])
  })
})

test('apply rejects an invalid row config before touching the terminal', () => {
  const ctx = createFakeContext({ loader: createFakeLoader([]) })
  assert.throws(() => apply(ctx, { interval: 20 }), /unknown config key "interval"/)
  assert.deepEqual(ctx.effects, [])
})
