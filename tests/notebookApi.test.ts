import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRemoteNotebook,
  loadRemoteNotebook,
  NotebookApiError,
  updateRemoteNotebook,
} from '../src/lib/notebookApi.ts'
import type { Notebook } from '../src/types.ts'

const origin = 'http://127.0.0.1:8000'
const id = '12345678-1234-1234-1234-123456789abc'
const snapshot: Notebook = {
  schemaVersion: 1,
  sections: [],
  contents: [],
  reminders: [],
}
const remote = { id, revision: 1, snapshot }

function mockFetch(handler: typeof fetch): () => void {
  const original = globalThis.fetch
  globalThis.fetch = handler
  return () => {
    globalThis.fetch = original
  }
}

test('rejects nonlocal origins before making a request', async () => {
  const restore = mockFetch(async () => {
    throw new Error('fetch must not be called')
  })
  try {
    await assert.rejects(createRemoteNotebook('https://example.com', snapshot))
    await assert.rejects(createRemoteNotebook('http://localhost.evil.test', snapshot))
    await assert.rejects(createRemoteNotebook('http://user:pass@localhost:8000', snapshot))
    await assert.rejects(createRemoteNotebook('http://localhost:8000/path', snapshot))
  } finally {
    restore()
  }
})

test('creates remote copy without credentials and leaves local data untouched', async () => {
  const restore = mockFetch(async (input, init) => {
    assert.equal(input, `${origin}/api/v1/notebooks`)
    assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'omit')
    assert.equal(init?.redirect, 'error')
    assert.deepEqual(JSON.parse(String(init?.body)), { snapshot })
    return Response.json(remote, { status: 201 })
  })
  try {
    assert.deepEqual(await createRemoteNotebook(origin, snapshot), remote)
    assert.deepEqual(snapshot, { schemaVersion: 1, sections: [], contents: [], reminders: [] })
  } finally {
    restore()
  }
})

test('loads a notebook and validates the response', async () => {
  const restore = mockFetch(async (input) => {
    assert.equal(input, `${origin}/api/v1/notebooks/${id}`)
    return Response.json(remote)
  })
  try {
    assert.deepEqual(await loadRemoteNotebook(origin, id), remote)
    assert.throws(() => loadRemoteNotebook(origin, '../unsafe'))
  } finally {
    restore()
  }
})

test('updates with optimistic revision and surfaces conflict', async () => {
  const restore = mockFetch(async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { revision: 1, snapshot })
    return Response.json({ detail: 'conflict' }, { status: 409 })
  })
  try {
    await assert.rejects(updateRemoteNotebook(origin, remote, snapshot), (error) => {
      assert.ok(error instanceof NotebookApiError)
      assert.equal(error.status, 409)
      return true
    })
  } finally {
    restore()
  }
})

test('rejects malformed success payloads instead of trusting the server', async () => {
  const restore = mockFetch(async () => Response.json({ ...remote, revision: 0 }))
  try {
    await assert.rejects(loadRemoteNotebook(origin, id), (error) => {
      assert.ok(error instanceof NotebookApiError)
      assert.equal(error.status, 200)
      return true
    })
  } finally {
    restore()
  }
})

test('reports unavailable API without retrying or writing locally', async () => {
  const restore = mockFetch(async () => {
    throw new TypeError('network error')
  })
  try {
    await assert.rejects(loadRemoteNotebook(origin, id), (error) => {
      assert.ok(error instanceof NotebookApiError)
      assert.equal(error.status, 0)
      return true
    })
  } finally {
    restore()
  }
})
