import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_FRAMES, MIN_INTERVAL_MS, normalizeConfig } from '../src/config.js'

test('normalizeConfig applies every documented default', () => {
  assert.deepEqual(normalizeConfig(), {
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
})

test('normalizeConfig accepts null as "no config"', () => {
  assert.equal(normalizeConfig(null).intervalMs, 80)
})

test('normalizeConfig returns a frozen value', () => {
  assert.equal(Object.isFrozen(normalizeConfig()), true)
  assert.equal(Object.isFrozen(normalizeConfig({ frames: ['a'] }).frames), true)
})

test('normalizeConfig overrides only the keys it is given', () => {
  const options = normalizeConfig({ label: 'Loading', showCompletion: false })
  assert.equal(options.label, 'Loading')
  assert.equal(options.showCompletion, false)
  assert.equal(options.showProgress, true)
})

test('normalizeConfig rejects an unknown key by name', () => {
  assert.throws(() => normalizeConfig({ interval: 20 }), /unknown config key "interval"/)
})

test('normalizeConfig rejects a non-mapping config', () => {
  assert.throws(() => normalizeConfig(['stderr']), /config must be a mapping/)
})

test('normalizeConfig rejects a wrong value and names its key', () => {
  assert.throws(() => normalizeConfig({ enabled: 'yes' }), /"enabled" must be a boolean/)
  assert.throws(() => normalizeConfig({ label: '' }), /"label" must be a non-empty string/)
  assert.throws(() => normalizeConfig({ doneLabel: 7 }), /"doneLabel" must be a non-empty string/)
  assert.throws(() => normalizeConfig({ frames: [] }), /"frames" must be a non-empty array/)
  assert.throws(() => normalizeConfig({ frames: [''] }), /"frames" must be a non-empty array/)
  assert.throws(() => normalizeConfig({ stream: 'tty' }), /"stream" must be "stderr" or "stdout"/)
})

test('normalizeConfig holds intervalMs to whole milliseconds at or above the frame budget', () => {
  assert.equal(normalizeConfig({ intervalMs: MIN_INTERVAL_MS }).intervalMs, MIN_INTERVAL_MS)
  assert.throws(() => normalizeConfig({ intervalMs: MIN_INTERVAL_MS - 1 }), /must be an integer >= 16/)
  assert.throws(() => normalizeConfig({ intervalMs: 20.5 }), /must be an integer >= 16/)
})
