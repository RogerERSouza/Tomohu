import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { useAccountNotebook } from '../../src/features/sync/useAccountNotebook'
import { workspaceKey } from '../../src/features/sync/workspaceStorage'
import { ApiError, createApiClient } from '../../src/lib/api/client'
import type { RemoteNotebook } from '../../src/lib/api/client'

const remote: RemoteNotebook = {
  id: 'book',
  revision: 1,
  snapshot: { schemaVersion: 1, sections: [], contents: [], reminders: [] },
}
const pending = {
  ...remote.snapshot,
  reminders: [{ id: 'r', title: 'Pending', date: '2030-05-10' }],
}
const client = () => createApiClient('http://127.0.0.1:8000', 'token')
afterEach(() => {
  cleanup()
  localStorage.clear()
})
test('sync acknowledges only the submitted version and preserves edits made during the request', async () => {
  let complete: (value: RemoteNotebook) => void = () => {
    throw new Error('Request not started')
  }
  const api = {
    ...client(),
    save: async () =>
      new Promise<RemoteNotebook>((resolve) => {
        complete = resolve
      }),
  }
  const { result } = renderHook(
    () => useAccountNotebook('alice', remote, api, () => {}),
    { wrapper: StrictMode },
  )
  await act(async () => result.current.setNotebook(pending))
  let sending: Promise<void> | undefined
  await act(async () => {
    sending = result.current.sync()
  })
  const newer = {
    ...pending,
    reminders: [{ ...pending.reminders[0], title: 'Newer edit' }],
  }
  await act(async () => result.current.setNotebook(newer))
  await act(async () => {
    complete({ ...remote, revision: 2, snapshot: pending })
    await sending
  })
  assert.deepEqual(result.current.notebook, newer)
  assert.equal(result.current.dirty, true)
  const cached = JSON.parse(
    localStorage.getItem(workspaceKey('alice', 'book')) ?? 'null',
  )
  assert.equal(cached.base.revision, 2)
  assert.deepEqual(cached.snapshot, newer)
  assert.equal(localStorage.getItem('task.notebook.v1'), null)
})
for (const status of [0, 401, 409, 422])
  test(`failed sync ${status} retains pending edits`, async () => {
    let expired = false
    const api = {
      ...client(),
      save: async () => {
        throw new ApiError(status)
      },
    }
    const { result } = renderHook(() =>
      useAccountNotebook('alice', remote, api, () => {
        expired = true
      }),
    )
    await act(async () => result.current.setNotebook(pending))
    await act(async () => result.current.sync())
    assert.deepEqual(result.current.notebook, pending)
    assert.equal(result.current.dirty, true)
    assert.equal(result.current.conflict, status === 409)
    assert.equal(expired, status === 401)
    assert.ok(result.current.message)
  })
test('remote loading after unmount cannot overwrite a pending cache', async () => {
  let complete: (value: RemoteNotebook) => void = () => {
    throw new Error('Request not started')
  }
  const api = {
    ...client(),
    get: async () =>
      new Promise<RemoteNotebook>((resolve) => {
        complete = resolve
      }),
  }
  const { result, unmount } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  await act(async () => result.current.setNotebook(pending))
  let loading: Promise<void> | undefined
  await act(async () => {
    loading = result.current.loadRemote()
  })
  const before = localStorage.getItem(workspaceKey('alice', 'book'))
  unmount()
  await act(async () => {
    complete({ ...remote, revision: 2 })
    await loading
  })
  assert.equal(localStorage.getItem(workspaceKey('alice', 'book')), before)
})
test('storage changes from another tab freeze saving and preserve the open snapshot', async () => {
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, client(), () => {}),
  )
  await act(async () => result.current.setNotebook(pending))
  await act(async () =>
    window.dispatchEvent(
      new window.StorageEvent('storage', {
        key: workspaceKey('alice', 'book'),
        newValue: 'other tab',
      }),
    ),
  )
  assert.equal(result.current.blocked, true)
  assert.match(result.current.storageError, /Outra aba/)
  assert.deepEqual(result.current.notebook, pending)
  assert.ok(
    Object.keys(localStorage).some((key) =>
      key.startsWith('tomohu.recovery.alice.book.'),
    ),
  )
})

test('failed local preservation prevents remote writes and allows a later explicit retry', async (context) => {
  let requests = 0
  const api = {
    ...client(),
    save: async () => {
      requests++
      return { ...remote, revision: 2, snapshot: pending }
    },
  }
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  await act(async () => result.current.setNotebook(pending))
  const write = context.mock.method(window.Storage.prototype, 'setItem', () => {
    throw new Error('Quota exceeded')
  })
  await act(async () => result.current.sync())
  assert.equal(requests, 0)
  assert.equal(result.current.dirty, true)
  write.mock.restore()
  await act(async () => result.current.sync())
  assert.equal(requests, 1)
  assert.equal(result.current.dirty, false)
})
