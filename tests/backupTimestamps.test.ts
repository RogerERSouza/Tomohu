import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNotebookBackup } from '../src/lib/notebook.ts'
import { formatDateTime } from '../src/lib/time.ts'

function backup(createdAt: string) {
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 's',
        parentId: null,
        title: 'Section',
        emoji: '',
        color: '#a7bcec',
      },
    ],
    reminders: [],
    contents: [
      {
        id: 'c',
        sectionId: 's',
        kind: 'counter',
        title: 'Counter',
        entries: [{ id: 'e', delta: 1, note: '', createdAt }],
      },
    ],
  }
}

test('backup validation rejects unparseable and out-of-range counter timestamps', () => {
  for (const timestamp of ['', 'not-a-date', '999999-01-01T00:00:00Z']) {
    assert.throws(() => parseNotebookBackup(JSON.stringify(backup(timestamp))))
  }
})

test('backup validation preserves valid legacy and current counter timestamps', () => {
  for (const timestamp of [
    '2026-10-26T12:00:00Z',
    '2026-10-26T12:00:00.123Z',
    '2026-10-26T09:00:00-03:00',
    '2026-10-26T09:00',
  ]) {
    const original = backup(timestamp)
    assert.deepEqual(parseNotebookBackup(JSON.stringify(original)), original)
  }
})

test('invalid counter dates have a safe display fallback', () => {
  assert.equal(formatDateTime(new Date('not-a-date'), '24h'), 'Data inválida')
})
