import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePrivateAutosave } from '../../src/features/privacy/usePrivateAutosave'
import type { PrivateDocument } from '../../src/features/privacy/privacyTypes'
import type { PrivateSnapshot } from '../../src/lib/api/privacy'

afterEach(cleanup)
function draft(): PrivateDocument {
  return {
    identity: 'owner:book',
    dirty: true,
    revision: 1,
    item: {
      id: 'private',
      kind: 'section',
      root_id: 'root',
      parent_id: null,
      position: 0,
    },
    snapshot: {
      schemaVersion: 1,
      sections: [
        {
          id: 'root',
          parentId: null,
          title: 'First',
          emoji: '',
          color: '#a7bcec',
        },
      ],
      contents: [],
      reminders: [],
    },
  }
}
test('private autosave serializes edits made during a request and clean flush completes', async () => {
  let document = draft()
  let release: ((value: PrivateSnapshot) => void) | undefined
  const revisions: number[] = []
  const { result } = renderHook(() =>
    usePrivateAutosave(
      document,
      () => document,
      (next) => {
        document = next
      },
      async (snapshot, revision) => {
        revisions.push(revision)
        if (revisions.length === 1)
          return new Promise<PrivateSnapshot>((resolve) => {
            release = resolve
          })
        return { snapshot, revision: revision + 1 }
      },
    ),
  )
  let pending: Promise<boolean> | undefined
  await act(async () => {
    pending = result.current.flush()
    await Promise.resolve()
  })
  assert.ok(release)
  document = {
    ...document,
    snapshot: {
      ...document.snapshot,
      sections: document.snapshot.sections.map((s) => ({
        ...s,
        title: 'Second',
      })),
    },
  }
  await act(async () => {
    release?.({ snapshot: draft().snapshot, revision: 2 })
    assert.equal(await pending, true)
  })
  assert.deepEqual(revisions, [1, 2])
  assert.equal(document.snapshot.sections[0].title, 'Second')
  assert.equal(document.dirty, false)
  await act(async () => {
    assert.equal(await result.current.flush(), true)
  })
})
test('failed private writes preserve the draft and explicit retry saves it', async () => {
  let document = draft()
  let fail = true
  const { result } = renderHook(() =>
    usePrivateAutosave(
      document,
      () => document,
      (next) => {
        document = next
      },
      async (snapshot, revision) => {
        if (fail) throw new Error('offline')
        return { snapshot, revision: revision + 1 }
      },
    ),
  )
  await act(async () => {
    assert.equal(await result.current.flush(), false)
  })
  assert.equal(document.dirty, true)
  assert.equal(document.revision, 1)
  fail = false
  await act(async () => {
    assert.equal(await result.current.flush(), true)
  })
  assert.equal(document.dirty, false)
  assert.equal(document.revision, 2)
})

test('private route projection keeps ancestors without importing public content', async () => {
  const { privateView, privateEdit, ownsPrivateRoute } =
    await import('../../src/features/privacy/privateNotebook')
  const document = draft()
  document.item.parent_id = 'public-parent'
  const publicBook = {
    ...document.snapshot,
    sections: [
      {
        id: 'public-parent',
        parentId: null,
        title: 'Public',
        emoji: '',
        color: '#a7bcec',
      },
    ],
    contents: [
      {
        id: 'public-note',
        sectionId: 'public-parent',
        kind: 'note' as const,
        title: 'Public',
        text: 'Public body',
      },
    ],
  }
  const view = privateView(publicBook, document.snapshot, document.item)
  assert.equal(
    view.sections.find((s) => s.id === 'root')?.parentId,
    'public-parent',
  )
  assert.equal(view.contents.length, 0)
  const edited = privateEdit(document.snapshot, view, document.item)
  assert.equal(edited.sections.length, 1)
  assert.equal(edited.sections[0].parentId, null)
  assert.equal(
    ownsPrivateRoute('#section/public-parent', edited, document.item),
    false,
  )
  assert.equal(ownsPrivateRoute('#section/root', edited, document.item), true)
})
