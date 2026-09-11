import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatCompletionLine, formatElapsed, formatStatusLine } from '../src/format.js'
import { normalizeConfig } from '../src/config.js'

const options = normalizeConfig()

test('formatElapsed renders tenths of a second', () => {
  assert.equal(formatElapsed(0), '0.0s')
  assert.equal(formatElapsed(18_400), '18.4s')
  assert.equal(formatElapsed(999), '1.0s')
  assert.equal(formatElapsed(1_049), '1.0s')
  assert.equal(formatElapsed(1_050), '1.1s')
})

test('formatElapsed clamps a non-finite or negative duration to zero', () => {
  assert.equal(formatElapsed(-1), '0.0s')
  assert.equal(formatElapsed(Number.NaN), '0.0s')
  assert.equal(formatElapsed(Number.POSITIVE_INFINITY), '0.0s')
})

test('formatStatusLine names the outstanding plugin, its duration, and its progress', () => {
  const line = formatStatusLine({ total: 57, done: 12, current: 'capability-menu-policy' }, 18_400, 3, options)
  assert.equal(line, '⠸ 正在加载 capability-menu-policy…  18.4s  12/57')
})

test('formatStatusLine cycles the configured spinner frames', () => {
  const frames = normalizeConfig({ frames: ['-', '\\', '|', '/'] })
  const snapshot = { total: 1, done: 0, current: 'a' }
  const rendered = [0, 1, 2, 3, 4].map(tick => formatStatusLine(snapshot, 0, tick, frames).split(' ')[0])
  assert.deepEqual(rendered, ['-', '\\', '|', '/', '-'])
})

test('formatStatusLine uses the ready label once every plugin is active', () => {
  const line = formatStatusLine({ total: 3, done: 3, current: undefined }, 1_000, 0, options)
  assert.equal(line, '⠋ 正在完成启动…  1.0s  3/3')
})

test('formatStatusLine drops the pieces its config turns off', () => {
  const minimal = normalizeConfig({ showElapsed: false, showProgress: false, label: 'Loading' })
  assert.equal(
    formatStatusLine({ total: 2, done: 1, current: 'web-app' }, 5_000, 0, minimal),
    '⠋ Loading web-app…',
  )
})

test('formatStatusLine reports an empty tree as loading rather than ready', () => {
  const line = formatStatusLine({ total: 0, done: 0, current: undefined }, 0, 0, options)
  assert.equal(line, '⠋ 正在加载…  0.0s')
})

test('formatCompletionLine reports the total startup duration', () => {
  assert.equal(formatCompletionLine(options, 18_440), '✔ 启动完成 (18.4s)')
})
