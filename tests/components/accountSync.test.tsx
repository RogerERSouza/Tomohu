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

test('pending remote load blocks imports without changing the open cache', async () => {
  let finish: (value: RemoteNotebook) => void = () => {}
  const api = {
    ...client(),
    get: async () =>
      new Promise<RemoteNotebook>((resolve) => {
        finish = resolve
      }),
  }
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  let loading: Promise<void> | undefined
  await act(async () => {
    loading = result.current.loadRemote()
  })
  const before = localStorage.getItem(workspaceKey('alice', 'book'))
  await act(async () =>
    assert.equal(result.current.replaceNotebook(pending), false),
  )
  assert.equal(localStorage.getItem(workspaceKey('alice', 'book')), before)
  await act(async () => {
    finish(remote)
    await loading
  })
  await act(async () =>
    assert.equal(result.current.replaceNotebook(pending), true),
  )
  assert.deepEqual(result.current.notebook, pending)
})

test('edits made while loading invalidate replacement and remain saved', async () => {
  let finish: (value: RemoteNotebook) => void = () => {}
  const api = {
    ...client(),
    get: async () =>
      new Promise<RemoteNotebook>((resolve) => {
        finish = resolve
      }),
  }
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  let loading: Promise<void> | undefined
  await act(async () => {
    loading = result.current.loadRemote()
  })
  await act(async () => result.current.setNotebook(pending))
  await act(async () => {
    finish({ ...remote, revision: 2 })
    await loading
  })
  assert.deepEqual(result.current.notebook, pending)
  assert.equal(result.current.dirty, true)
  assert.match(result.current.message, /Nada foi substituído/)
  assert.deepEqual(
    JSON.parse(localStorage.getItem(workspaceKey('alice', 'book')) ?? 'null')
      .snapshot,
    pending,
  )
})

for (const deliverEvent of [true, false])
  test(`another tab draft invalidates recovery even with storage event delivery=${deliverEvent}`, async () => {
    let finish: (value: RemoteNotebook) => void = () => {}
    const api = {
      ...client(),
      get: async () =>
        new Promise<RemoteNotebook>((resolve) => {
          finish = resolve
        }),
    }
    const { result } = renderHook(() =>
      useAccountNotebook('alice', remote, api, () => {}),
    )
    let loading: Promise<void> | undefined
    await act(async () => {
      loading = result.current.loadRemote()
    })
    const key = workspaceKey('alice', 'book')
    const other = JSON.stringify({
      version: 1,
      ownerId: 'alice',
      base: remote,
      snapshot: pending,
    })
    await act(async () => {
      localStorage.setItem(key, other)
      if (deliverEvent)
        window.dispatchEvent(
          new window.StorageEvent('storage', { key, newValue: other }),
        )
    })
    await act(async () => {
      finish(remote)
      await loading
    })
    assert.equal(localStorage.getItem(key), other)
    assert.equal(result.current.blocked, true)
    assert.equal(result.current.busy, false)
    // A later explicit recovery can replace the preserved cache, not the stale request.
    await act(async () => {
      loading = result.current.loadRemote()
    })
    await act(async () => {
      finish({ ...remote, revision: 2 })
      await loading
    })
    assert.equal(result.current.blocked, false)
    assert.deepEqual(result.current.notebook, remote.snapshot)
  })

test('external cache changes detected before a storage event block autosave and upload', async () => {
  let requests = 0
  const api = {
    ...client(),
    save: async () => {
      requests++
      return remote
    },
  }
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  const key = workspaceKey('alice', 'book')
  localStorage.setItem(key, 'external draft')
  await act(async () => result.current.setNotebook(pending))
  await act(async () => result.current.sync())
  assert.equal(result.current.blocked, true)
  assert.equal(requests, 0)
  assert.equal(localStorage.getItem(key), 'external draft')
})

test('canonical date acknowledgement is clean while later edits remain dirty', async () => {
  const local = {
    ...remote.snapshot,
    sections: [
      { id: 's', parentId: null, title: 'Root', emoji: '', color: '#123456' },
    ],
    contents: [
      {
        id: 'counter',
        sectionId: 's',
        title: 'Counter',
        kind: 'counter' as const,
        entries: [
          {
            id: 'e',
            delta: 1,
            note: '',
            createdAt: 'Wed, 01 Jan 2025 00:00:00 GMT',
          },
        ],
      },
    ],
  }
  const canonical = structuredClone(local)
  canonical.contents[0].entries[0].createdAt = '2025-01-01T00:00:00.000Z'
  const api = {
    ...client(),
    save: async () => ({ ...remote, revision: 2, snapshot: canonical }),
  }
  const { result } = renderHook(() =>
    useAccountNotebook('alice', remote, api, () => {}),
  )
  await act(async () => result.current.setNotebook(local))
  await act(async () => result.current.sync())
  assert.equal(result.current.dirty, false)
  assert.deepEqual(result.current.notebook, local)
  await act(async () =>
    result.current.setNotebook({ ...local, reminders: pending.reminders }),
  )
  assert.equal(result.current.dirty, true)
})
