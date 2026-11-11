import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNotebookBackup } from '../src/lib/notebook.ts'
import { readWorkspaceCache } from '../src/lib/workspaceCache.ts'
import type { Notebook } from '../src/types'

const snapshot: Notebook = {
  schemaVersion: 1,
  sections: [],
  contents: [],
  reminders: [{ id: 'draft', title: 'Recovered draft', date: '2030-05-10' }],
}
const cache = {
  version: 1,
  ownerId: 'alice',
  base: { id: 'book', revision: 2, snapshot: { ...snapshot, reminders: [] } },
  snapshot,
}

test('old preserved cache envelopes restore only the validated draft snapshot', () => {
  assert.deepEqual(parseNotebookBackup(JSON.stringify(cache)), snapshot)
  assert.deepEqual(readWorkspaceCache(cache).snapshot, snapshot)
})

for (const invalid of [
  { ...cache, version: 2 },
  { ...cache, ownerId: '' },
  { ...cache, base: { ...cache.base, revision: 0 } },
  { ...cache, base: { ...cache.base, snapshot: {} } },
  {
    ...cache,
    snapshot: {
      ...snapshot,
      reminders: [{ id: 'r', title: 'Invalid', date: 'invalid' }],
    },
  },
])
  test('invalid recovery metadata or snapshot never bypasses notebook validation', () => {
    assert.throws(() => parseNotebookBackup(JSON.stringify(invalid)))
  })
