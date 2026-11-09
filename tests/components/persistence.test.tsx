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
