import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readBootStart, readProgress } from '../src/progress.js'

/** A loader row whose module has imported and whose fiber reached the active state. */
const active = name => ({ options: { id: name, name }, fiber: { state: 2 } })
/** A loader row whose module has not finished importing. */
const importing = name => ({ options: { id: name, name } })
/** A loader row whose module imported but whose fiber is waiting on a service. */
const pending = name => ({ options: { id: name, name }, fiber: { state: 0 } })

test('readProgress counts plugin rows and names the longest-outstanding one', () => {
  const loader = { entries: () => [active('a'), importing('b'), pending('c'), active('d')] }
  assert.deepEqual(readProgress(loader), { total: 4, done: 2, current: 'b' })
})

test('readProgress advances the subject as earlier rows become active', () => {
  const first = { entries: () => [importing('a'), importing('b')] }
  assert.equal(readProgress(first).current, 'a')
  const second = { entries: () => [active('a'), importing('b')] }
  assert.equal(readProgress(second).current, 'b')
})

test('readProgress reports no subject once every row is active', () => {
  const loader = { entries: () => [active('a'), active('b')] }
  assert.deepEqual(readProgress(loader), { total: 2, done: 2, current: undefined })
})

test('readProgress excludes group rows and disabled rows from the totals', () => {
  const group = { options: { id: 'g', name: 'cordis:group', group: true } }
  const disabled = { options: { id: 'x', name: 'x' }, disabled: true }
  const loader = { entries: () => [group, disabled, active('a')] }
  assert.deepEqual(readProgress(loader), { total: 1, done: 1, current: undefined })
})

test('readProgress excludes a tree carrier, whose duration is the whole boot', () => {
  const include = { options: { id: 'include', name: 'cordis:include' }, subtree: {}, fiber: { state: 1 } }
  const loader = { entries: () => [include, importing('a')] }
  assert.deepEqual(readProgress(loader), { total: 1, done: 0, current: 'a' })
})

test('readProgress tolerates an entry with no options', () => {
  const loader = { entries: () => [{}, active('a')] }
  assert.deepEqual(readProgress(loader), { total: 1, done: 1, current: undefined })
})

test('readBootStart prefers the Loader stamp', () => {
  assert.equal(readBootStart({ envData: { startTime: 1_000 } }, 2_000), 1_000)
})

test('readBootStart falls back when the stamp is missing, unusable, or in the future', () => {
  assert.equal(readBootStart(undefined, 2_000), 2_000)
  assert.equal(readBootStart({}, 2_000), 2_000)
  assert.equal(readBootStart({ envData: { startTime: 'ago' } }, 2_000), 2_000)
  assert.equal(readBootStart({ envData: { startTime: Number.NaN } }, 2_000), 2_000)
  assert.equal(readBootStart({ envData: { startTime: 3_000 } }, 2_000), 2_000)
})
