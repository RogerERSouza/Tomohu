import assert from 'node:assert/strict'
import test from 'node:test'
import { createDevelopmentNotebook } from '../src/lib/developmentNotebook.ts'

test('development payload is empty and isolated from user data', () => {
  const first = createDevelopmentNotebook()
  assert.deepEqual(first, {
    schemaVersion: 1,
    sections: [],
    contents: [],
    reminders: [],
  })
  first.sections.push({
    id: 'fixture',
    parentId: null,
    title: 'Fixture',
    emoji: '',
    color: '#a7bcec',
  })
  assert.equal(createDevelopmentNotebook().sections.length, 0)
})
