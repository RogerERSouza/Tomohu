import assert from 'node:assert/strict'
import test from 'node:test'
import { isNotebook } from '../src/lib/notebookValidation.ts'
import { prepareAccountSnapshot } from '../src/lib/api/snapshot.ts'
import { createApiClient } from '../src/lib/api/client.ts'
import { sameNotebook } from '../src/features/sync/workspaceStorage.ts'
import { parseNotebookBackup } from '../src/lib/notebook.ts'

import fixtures from './fixtures/accountSnapshotContract.json' with { type: 'json' }

test('shared API canonical fixtures remain valid frontend notebooks', () => {
  assert.ok(isNotebook(fixtures.optionalNulls.canonical))
  assert.ok(isNotebook(fixtures.legacyCounter.canonical))
})

test('legacy counter dates normalize on a copy without changing local backups', () => {
  const local = parseNotebookBackup(
    JSON.stringify(fixtures.legacyCounter.local),
  )
  const before = JSON.stringify(local)
  const wire = prepareAccountSnapshot(local)
  assert.deepEqual(wire, fixtures.legacyCounter.canonical)
  assert.equal(JSON.stringify(local), before)
  assert.equal(sameNotebook(local, wire), true)
  const reordered = {
    reminders: wire.reminders,
    contents: wire.contents,
    sections: wire.sections,
    schemaVersion: wire.schemaVersion,
  }
  assert.equal(sameNotebook(local, reordered), true)
  const changed = structuredClone(wire)
  if (changed.contents[0].kind === 'counter')
    changed.contents[0].entries[0].note = 'Edited'
  assert.equal(sameNotebook(local, changed), false)
})

test('create and update both send canonical dates and preserve their input', async (context) => {
  const local = parseNotebookBackup(
    JSON.stringify(fixtures.legacyCounter.local),
  )
  const before = JSON.stringify(local)
  const methods: string[] = []
  context.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      assert.deepEqual(body.snapshot, fixtures.legacyCounter.canonical)
      methods.push(String(options.method))
      return new Response(
        JSON.stringify({
          id: 'book',
          revision: options.method === 'POST' ? 1 : 2,
          snapshot: body.snapshot,
        }),
      )
    },
  )
  const api = createApiClient('http://localhost:8000', 'token')
  await api.create(local)
  await api.save('book', 1, local)
  assert.deepEqual(methods, ['POST', 'PUT'])
  assert.equal(JSON.stringify(local), before)
})

test('out-of-range counter dates fail locally with an actionable error', () => {
  const local = parseNotebookBackup(
    JSON.stringify(fixtures.legacyCounter.local),
  )
  if (local.contents[0].kind === 'counter')
    local.contents[0].entries[0].createdAt = '+010000-01-01T00:00:00Z'
  assert.throws(() => prepareAccountSnapshot(local), /contador.*0001 a 9999/)
})
