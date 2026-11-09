import assert from 'node:assert/strict'
import test from 'node:test'
import { selectCollection } from '../src/features/sections/selectCollection.ts'
import type { CollectionFilters } from '../src/features/sections/collectionTypes.ts'
import type { Notebook } from '../src/types.ts'

const notebook: Notebook = {
  schemaVersion: 1,
  sections: [
    {
      id: 'a',
      parentId: null,
      title: 'Alpha',
      emoji: '',
      color: '#a7bcec',
      tags: ['study'],
    },
    {
      id: 'z',
      parentId: null,
      title: 'Zeta',
      emoji: '',
      color: '#edcf94',
      favorite: true,
    },
    { id: 'child', parentId: 'a', title: 'Child', emoji: '', color: '#a7bcec' },
  ],
  contents: [
    {
      id: 'note',
      sectionId: 'a',
      title: 'Nested note',
      kind: 'note',
      text: 'Searchable words',
    },
  ],
  reminders: [],
}
const controls: CollectionFilters = {
  query: '',
  sortOrder: 'alphabetical',
  colorFilter: null,
  tagFilter: null,
}

test('favorites take precedence over sorting without mutating the saved notebook', () => {
  const before = structuredClone(notebook)
  const result = selectCollection(notebook, undefined, true, controls, false)
  assert.deepEqual(
    result.visibleSections.map((section) => section.id),
    ['z', 'a'],
  )
  assert.deepEqual(result.usedTags, ['study'])
  assert.deepEqual(notebook, before)
})

test('section scope and filters preserve the existing content visibility rules', () => {
  const result = selectCollection(
    notebook,
    notebook.sections[0],
    false,
    { ...controls, tagFilter: 'missing' },
    true,
  )
  assert.equal(result.visibleSections.length, 0)
  assert.deepEqual(
    result.contentColumns.map((column) => column.map((item) => item.id)),
    [['note']],
  )
  const colored = selectCollection(
    notebook,
    notebook.sections[0],
    false,
    { ...controls, colorFilter: '#a7bcec' },
    false,
  )
  assert.deepEqual(
    colored.visibleSections.map((section) => section.id),
    ['child'],
  )
  assert.equal(colored.visibleContents.length, 0)
})

test('global text search reaches nested content while section search remains local', () => {
  const global = selectCollection(
    notebook,
    undefined,
    true,
    { ...controls, query: ' Searchable ' },
    false,
  )
  assert.equal(global.isGlobalSearchActive, true)
  assert.equal(global.globalSearchResults[0]?.id, 'note')
  const local = selectCollection(
    notebook,
    notebook.sections[0],
    false,
    { ...controls, query: 'Searchable' },
    false,
  )
  assert.equal(local.isGlobalSearchActive, false)
  assert.equal(local.visibleContents.length, 0)
})
