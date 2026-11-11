import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useNotebook } from '../../src/features/notebook/useNotebook'
import { createNotebookActions } from '../../src/features/notebook/createNotebookActions'
import { getCounterTotal, STORAGE_KEY } from '../../src/lib/notebook'
import type { Notebook } from '../../src/types'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const saved: Notebook = {
  schemaVersion: 1,
  sections: [
    { id: 's', parentId: null, title: 'Saved', emoji: '', color: '#a7bcec' },
  ],
  contents: [
    { id: 'c', sectionId: 's', kind: 'counter', title: 'Counter', entries: [] },
  ],
  reminders: [],
}

test('Strict Mode reads legacy data and batches counter changes without stale snapshots', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const { result, unmount } = renderHook(
    () => {
      const state = useNotebook()
      return { ...state, actions: createNotebookActions(state.setNotebook) }
    },
    { wrapper: StrictMode },
  )
  await act(async () => {
    result.current.actions.changeCount('c', 1)
    result.current.actions.changeCount('c', 1)
    result.current.actions.changeCount('c', -1)
    result.current.actions.toggleFavorite('s')
  })
  const counter = result.current.notebook.contents[0]
  assert.equal(counter.kind, 'counter')
  if (counter.kind !== 'counter') throw new Error('Expected counter')
  assert.equal(getCounterTotal(counter.entries), 1)
  assert.equal(counter.entries.length, 3)
  assert.equal(result.current.notebook.sections[0].favorite, true)
  const expected = structuredClone(result.current.notebook)
  unmount()
  const reloaded = renderHook(useNotebook, { wrapper: StrictMode })
  assert.deepEqual(reloaded.result.current.notebook, expected)
})

test('invalid stored data survives loading and editing the fallback notebook', async () => {
  localStorage.setItem(STORAGE_KEY, '{damaged')
  const { result } = renderHook(useNotebook, { wrapper: StrictMode })
  await act(async () => result.current.setNotebook(saved))
  assert.match(result.current.storageError, /salvamento foi pausado/)
  assert.equal(localStorage.getItem(STORAGE_KEY), '{damaged')
})

test('structurally valid but inconsistent saved data is preserved until confirmed recovery', async () => {
  const invalid = { ...saved, sections: [] }
  const original = JSON.stringify(invalid)
  localStorage.setItem(STORAGE_KEY, original)
  const { result, unmount } = renderHook(useNotebook, { wrapper: StrictMode })
  assert.match(result.current.storageError, /salvamento foi pausado/)
  await act(async () => result.current.setNotebook(saved))
  assert.equal(localStorage.getItem(STORAGE_KEY), original)
  await act(async () => {
    assert.equal(result.current.replaceNotebook(saved), true)
  })
  unmount()
  const reloaded = renderHook(useNotebook)
  assert.equal(reloaded.result.current.storageError, '')
  assert.deepEqual(reloaded.result.current.notebook, saved)
})

test('counter actions reject nonfinite updates while preserving valid corrections', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const { result } = renderHook(() => {
    const state = useNotebook()
    return { ...state, actions: createNotebookActions(state.setNotebook) }
  })
  await act(async () => {
    for (const delta of [NaN, Infinity, -Infinity, -1])
      result.current.actions.changeCount('c', delta)
    result.current.actions.changeCount('c', 2)
    result.current.actions.changeCount('c', -1)
  })
  const counter = result.current.notebook.contents[0]
  if (counter.kind !== 'counter') throw new Error('Expected counter')
  assert.deepEqual(
    counter.entries.map((entry) => entry.delta),
    [2, -1],
  )
  assert.equal(getCounterTotal(counter.entries), 1)
})

test('a failed backup replacement keeps the current notebook and reports the failure', async (context) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const { result } = renderHook(useNotebook)
  await act(async () => {})
  context.mock.method(window.Storage.prototype, 'setItem', () => {
    throw new Error('Storage blocked')
  })
  await act(async () => {
    assert.equal(
      result.current.replaceNotebook({ ...saved, sections: [], contents: [] }),
      false,
    )
  })
  assert.deepEqual(result.current.notebook, saved)
  assert.match(result.current.storageError, /Não foi possível importar/)
  assert.equal(localStorage.getItem(STORAGE_KEY), JSON.stringify(saved))
})

test('a confirmed recovery resumes autosave and keeps later edits after remount', async () => {
  localStorage.setItem(STORAGE_KEY, '{damaged')
  const { result, unmount } = renderHook(useNotebook, { wrapper: StrictMode })
  const replacement = structuredClone(saved)
  await act(async () => {
    assert.equal(result.current.replaceNotebook(replacement), true)
  })
  assert.equal(result.current.storageError, '')
  await act(async () => {
    result.current.setNotebook((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        title: 'Edited after recovery',
      })),
    }))
  })
  const expected = structuredClone(result.current.notebook)
  unmount()
  const reloaded = renderHook(useNotebook, { wrapper: StrictMode })
  assert.deepEqual(reloaded.result.current.notebook, expected)
  assert.equal(
    reloaded.result.current.notebook.sections[0].title,
    'Edited after recovery',
  )
})

test('a failed recovery keeps saving blocked until an explicit replacement succeeds', async (context) => {
  localStorage.setItem(STORAGE_KEY, '{damaged')
  const { result } = renderHook(useNotebook, { wrapper: StrictMode })
  const write = context.mock.method(window.Storage.prototype, 'setItem', () => {
    throw new Error('Storage blocked')
  })
  await act(async () => {
    assert.equal(result.current.replaceNotebook(saved), false)
  })
  write.mock.restore()
  await act(async () => {
    result.current.setNotebook(saved)
  })
  assert.equal(localStorage.getItem(STORAGE_KEY), '{damaged')
  await act(async () => {
    assert.equal(result.current.replaceNotebook(saved), true)
  })
  await act(async () => {
    result.current.setNotebook((current) => ({
      ...current,
      reminders: [{ id: 'r', title: 'After recovery', date: '2030-05-12' }],
    }))
  })
  assert.deepEqual(
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'),
    result.current.notebook,
  )
})

for (const deliverEvent of [true, false])
  test(`guest drafts survive external writes with storage event delivery=${deliverEvent}`, async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    const { result, unmount } = renderHook(useNotebook, { wrapper: StrictMode })
    const other = {
      ...saved,
      reminders: [
        { id: 'other', title: 'Other tab draft', date: '2030-05-12' },
      ],
    }
    const raw = JSON.stringify(other)
    await act(async () => {
      localStorage.setItem(STORAGE_KEY, raw)
      if (deliverEvent)
        window.dispatchEvent(
          new window.StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: raw,
          }),
        )
      result.current.setNotebook((current) => ({
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          favorite: true,
        })),
      }))
    })
    assert.equal(localStorage.getItem(STORAGE_KEY), raw)
    assert.match(result.current.storageError, /Outra aba/)
    assert.ok(
      Object.keys(localStorage).some((key) =>
        key.startsWith('tomohu.guest.recovery.'),
      ),
    )
    await act(async () =>
      assert.equal(result.current.replaceNotebook(saved), true),
    )
    assert.ok(
      Object.keys(localStorage).some(
        (key) =>
          key.startsWith('tomohu.guest.recovery.') &&
          localStorage.getItem(key) === raw,
      ),
    )
    await act(async () => result.current.setNotebook(other))
    assert.deepEqual(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'),
      other,
    )
    unmount()
    const reloaded = renderHook(useNotebook)
    assert.deepEqual(reloaded.result.current.notebook, other)
  })

test('a guest clear event pauses writes and keeps the open notebook exportable', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const { result } = renderHook(useNotebook)
  await act(async () => {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new window.StorageEvent('storage', { key: null }))
    result.current.setNotebook({ ...saved, reminders: [] })
  })
  assert.equal(localStorage.getItem(STORAGE_KEY), null)
  assert.match(result.current.storageError, /Outra aba/)
  assert.deepEqual(result.current.notebook, { ...saved, reminders: [] })
})
