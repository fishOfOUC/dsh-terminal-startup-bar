import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ERASE_LINE, createStartupBar } from '../src/bar.js'
import { normalizeConfig } from '../src/config.js'

/** A loader row whose fiber reached the active state. */
const active = name => ({ options: { id: name, name }, fiber: { state: 2 } })

/**
 * Build a bar over a recording stream and a hand-driven clock.
 * @param {object} [setup] - `entries` supplies the loader's rows, `config` the row config.
 * @returns the bar plus the recorded writes and the scheduled repaints.
 */
function harness({ entries = [], config = {} } = {}) {
  const written = []
  const intervals = new Map()
  let nextHandle = 1
  let now = 1_000
  const bar = createStartupBar({
    stream: { write: chunk => written.push(chunk) },
    options: normalizeConfig(config),
    readLoader: () => ({ entries: () => entries }),
    now: () => now,
    timers: {
      setInterval: (callback, ms) => { intervals.set(nextHandle, { callback, ms }); return nextHandle++ },
      clearInterval: handle => { intervals.delete(handle) },
    },
  })
  return {
    bar,
    written,
    intervals,
    advance: ms => { now += ms },
    repaint: () => { for (const { callback } of [...intervals.values()]) callback() },
  }
}

test('start paints the first frame immediately and schedules the next repaints', () => {
  const { bar, written, intervals } = harness({ entries: [active('a'), { options: { id: 'b', name: 'b' } }] })
  bar.start(1_000)
  assert.deepEqual(written, [`${ERASE_LINE}⠋ 正在加载 b…  0.0s  1/2`])
  assert.equal(intervals.size, 1)
  assert.equal([...intervals.values()][0].ms, 80)
})

test('each repaint advances the spinner frame and the elapsed time', () => {
  const { bar, written, repaint, advance } = harness({ entries: [{ options: { id: 'a', name: 'a' } }] })
  bar.start(1_000)
  advance(400)
  repaint()
  assert.deepEqual(written[1], `${ERASE_LINE}⠙ 正在加载 a…  0.4s  0/1`)
})

test('a repaint after the loader went away keeps the last snapshot', () => {
  const written = []
  let live = true
  const intervals = new Map()
  const bar = createStartupBar({
    stream: { write: chunk => written.push(chunk) },
    options: normalizeConfig(),
    readLoader: () => (live ? { entries: () => [{ options: { id: 'a', name: 'a' } }] } : undefined),
    now: () => 1_000,
    timers: {
      setInterval: callback => { intervals.set(1, { callback }); return 1 },
      clearInterval: () => {},
    },
  })
  bar.start(1_000)
  live = false
  for (const { callback } of [...intervals.values()]) callback()
  assert.deepEqual(written, [
    `${ERASE_LINE}⠋ 正在加载 a…  0.0s  0/1`,
    `${ERASE_LINE}⠙ 正在加载 a…  0.0s  0/1`,
  ])
})

test('finish erases the bar and reports the total duration', () => {
  const { bar, written, advance, intervals } = harness({ entries: [active('a')] })
  bar.start(1_000)
  advance(18_400)
  bar.finish()
  assert.deepEqual(written, [`${ERASE_LINE}⠋ 正在完成启动…  0.0s  1/1`, ERASE_LINE, '✔ 启动完成 (18.4s)\n'])
  assert.equal(intervals.size, 0)
})

test('finish omits the closing line when the config turns it off', () => {
  const { bar, written } = harness({ config: { showCompletion: false } })
  bar.start(1_000)
  bar.finish()
  assert.deepEqual(written.slice(1), [ERASE_LINE])
})

test('dispose erases the bar without reporting anything', () => {
  const { bar, written, intervals } = harness()
  bar.start(1_000)
  bar.dispose()
  assert.deepEqual(written.slice(1), [ERASE_LINE])
  assert.equal(intervals.size, 0)
})

test('finish after dispose is a no-op', () => {
  const { bar, written } = harness()
  bar.start(1_000)
  bar.dispose()
  const before = written.length
  bar.finish()
  bar.dispose()
  assert.equal(written.length, before)
})

test('start after the bar stopped does not paint again', () => {
  const { bar, written } = harness()
  bar.start(1_000)
  bar.dispose()
  const before = written.length
  bar.start(1_000)
  assert.equal(written.length, before)
})
