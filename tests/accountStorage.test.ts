import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  loadWorkspace,
  saveWorkspace,
  workspaceKey,
} from '../src/features/sync/workspaceStorage.ts'
import { apiBaseUrl, ApiError, createApiClient } from '../src/lib/api/client.ts'
import type { RemoteNotebook } from '../src/lib/api/client.ts'

const items = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  },
  configurable: true,
})
const remote: RemoteNotebook = {
  id: 'book',
  revision: 1,
  snapshot: { schemaVersion: 1, sections: [], contents: [], reminders: [] },
}
afterEach(() => items.clear())
test('guest data and account caches remain isolated across owners', () => {
  items.set('task.notebook.v1', 'original guest')
  saveWorkspace({
    version: 1,
    ownerId: 'alice',
    base: remote,
    snapshot: remote.snapshot,
  })
  assert.equal(items.get('task.notebook.v1'), 'original guest')
  assert.equal(items.has(workspaceKey('bob', 'book')), false)
  assert.equal(loadWorkspace('bob', remote).blocked, false)
})
test('a dirty cache is retained and marks a changed remote revision as a conflict', () => {
  const snapshot = {
    ...remote.snapshot,
    reminders: [{ id: 'r', title: 'Pending', date: '2030-05-10' }],
  }
  saveWorkspace({ version: 1, ownerId: 'alice', base: remote, snapshot })
  assert.equal(loadWorkspace('alice', remote).conflict, false)
  const result = loadWorkspace('alice', { ...remote, revision: 2 })
  assert.equal(result.conflict, true)
  assert.deepEqual(result.cache.snapshot, snapshot)
  assert.equal(result.cache.base.revision, 1)
})
test('an untouched cache loads the latest remote snapshot', () => {
  saveWorkspace({
    version: 1,
    ownerId: 'alice',
    base: remote,
    snapshot: remote.snapshot,
  })
  assert.equal(
    loadWorkspace('alice', { ...remote, revision: 2 }).cache.base.revision,
    2,
  )
})
test('corrupt or wrong-owner caches are preserved with saving blocked', () => {
  for (const raw of [
    '{damaged',
    JSON.stringify({
      version: 1,
      ownerId: 'bob',
      base: remote,
      snapshot: remote.snapshot,
    }),
  ]) {
    items.set(workspaceKey('alice', 'book'), raw)
    assert.equal(loadWorkspace('alice', remote).blocked, true)
    assert.equal(items.get(workspaceKey('alice', 'book')), raw)
  }
})
test('API configuration rejects credentials, insecure remote origins and paths', () => {
  for (const url of [
    'http://example.com',
    'https://name:secret@example.com',
    'https://example.com/path',
    'https://example.com?token=x',
  ])
    assert.throws(() => apiBaseUrl(url))
  assert.equal(apiBaseUrl('http://127.0.0.1:8000'), 'http://127.0.0.1:8000')
  assert.equal(
    apiBaseUrl('https://api.example.com/'),
    'https://api.example.com',
  )
})
test('bearer calls omit browser credentials and validate returned snapshots', async (context) => {
  let options: RequestInit | undefined
  context.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init?: RequestInit) => {
      options = init
      return Response.json(remote)
    },
  )
  assert.deepEqual(
    await createApiClient('https://api.example.com', 'private-token').get(
      'book',
    ),
    remote,
  )
  assert.equal(options?.credentials, 'omit')
  assert.equal(options?.cache, 'no-store')
  assert.equal(options?.redirect, 'error')
  assert.equal(
    new Headers(options?.headers).get('Authorization'),
    'Bearer private-token',
  )
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...remote, snapshot: {} }),
  )
  await assert.rejects(
    createApiClient('https://api.example.com', 'private-token').get('book'),
    (error) => error instanceof ApiError && error.status === 502,
  )
})

test('account limits are checked before any request without truncating local data', async (context) => {
  const snapshot = {
    ...remote.snapshot,
    sections: [
      {
        id: 's',
        parentId: null,
        title: 'Section',
        emoji: '📚',
        color: '#a7bcec',
      },
    ],
    contents: [
      {
        id: 'n',
        sectionId: 's',
        title: 'Long note',
        kind: 'note' as const,
        text: 'x'.repeat(20001),
      },
    ],
  }
  const fetch = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Should not reach network')
  })
  await assert.rejects(
    createApiClient('https://api.example.com', 'token').create(snapshot),
    /20.000/,
  )
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(snapshot.contents[0].text.length, 20001)
})
