import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNotebookBackup } from '../src/lib/notebook.ts'
import type { Notebook } from '../src/types.ts'

function backup(): Notebook {
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 'root',
        parentId: null,
        title: 'Root',
        emoji: '',
        color: '#a7bcec',
      },
      {
        id: 'child',
        parentId: 'root',
        title: 'Child',
        emoji: '',
        color: '#a7bcec',
      },
    ],
    contents: [
      { id: 'note', sectionId: 'root', kind: 'note', title: 'Note', text: '' },
      {
        id: 'list',
        sectionId: 'child',
        kind: 'checklist',
        title: 'List',
        items: [
          { id: 'item', text: 'First', completed: false },
          { id: 'second', text: 'Second', completed: true },
        ],
      },
      {
        id: 'counter',
        sectionId: 'root',
        kind: 'counter',
        title: 'Counter',
        entries: [
          {
            id: 'increase',
            delta: 2,
            note: '',
            createdAt: '2030-05-10T09:00:00Z',
          },
          {
            id: 'correction',
            delta: -1,
            note: '',
            createdAt: '2030-05-10T10:00:00Z',
          },
        ],
      },
    ],
    reminders: [
      {
        id: 'event',
        title: 'Event',
        date: '2030-05-10',
        schedule: 'time-range',
        startTime: '09:00',
        endTime: '10:00',
      },
    ],
  }
}

const invalidCases: Record<string, (value: Notebook) => void> = {
  'invalid reminder date': (value) => {
    value.reminders[0].date = 'not-a-date'
  },
  'invalid legacy clock': (value) => {
    value.reminders[0] = {
      id: 'legacy',
      title: 'Legacy',
      date: '2030-05-10T24:00',
    }
  },
  'nonexistent calendar date': (value) => {
    value.reminders[0].date = '2030-02-30'
  },
  'invalid end date': (value) => {
    value.reminders[0].endDate = '2030-04-31'
  },
  'invalid clock hour': (value) => {
    value.reminders[0].startTime = '24:00'
  },
  'invalid clock minute': (value) => {
    value.reminders[0].endTime = '09:60'
  },
  'trailing clock fields': (value) => {
    value.reminders[0].startTime = '09:00:30'
  },
  'missing timed occurrence': (value) => {
    delete value.reminders[0].startTime
    delete value.reminders[0].endTime
  },
  'inverted dates': (value) => {
    value.reminders[0].endDate = '2030-05-09'
  },
  'inverted interval': (value) => {
    value.reminders[0].endTime = '08:00'
  },
  'zero duration interval': (value) => {
    value.reminders[0].endTime = '09:00'
  },
  'duplicate daily times': (value) => {
    value.reminders[0].repeatTimes = ['09:00', '09:00']
  },
  'invalid daily time': (value) => {
    value.reminders[0].repeatTimes = ['99:99']
  },
  'duplicate section IDs': (value) => {
    value.sections[1].id = 'root'
  },
  'empty IDs': (value) => {
    value.sections[0].id = ''
  },
  'missing parent': (value) => {
    value.sections[1].parentId = 'missing'
  },
  'self parent': (value) => {
    value.sections[0].parentId = 'root'
  },
  'parent cycle': (value) => {
    value.sections[0].parentId = 'child'
  },
  'orphan content': (value) => {
    value.contents[0].sectionId = 'missing'
  },
  'duplicate content IDs': (value) => {
    value.contents[1].id = 'note'
  },
  'duplicate reminder IDs': (value) => {
    value.reminders.push({ ...value.reminders[0] })
  },
  'duplicate list item IDs': (value) => {
    const list = value.contents[1]
    if (list.kind === 'checklist') list.items[1].id = 'item'
  },
  'duplicate counter entry IDs': (value) => {
    const counter = value.contents[2]
    if (counter.kind === 'counter') counter.entries[1].id = 'increase'
  },
  'negative counter total': (value) => {
    const counter = value.contents[2]
    if (counter.kind === 'counter') counter.entries[0].delta = -2
  },
  'overflowing counter total': (value) => {
    const counter = value.contents[2]
    if (counter.kind === 'counter')
      for (const entry of counter.entries) entry.delta = Number.MAX_VALUE
  },
}

for (const [name, invalidate] of Object.entries(invalidCases)) {
  test(`backup rejects ${name} without changing its input`, () => {
    const value = backup()
    invalidate(value)
    const text = JSON.stringify(value)
    assert.throws(() => parseNotebookBackup(text))
    assert.equal(JSON.stringify(value), text)
  })
}

test('valid hierarchy, correction entries and scoped IDs survive backup round trips', () => {
  const value = backup()
  const list = value.contents[1]
  if (list.kind !== 'checklist') throw new Error('Expected checklist')
  value.contents.push({
    ...list,
    id: 'another-list',
    items: structuredClone(list.items),
  })
  value.reminders[0].id = 'root'
  assert.deepEqual(parseNotebookBackup(JSON.stringify(value)), value)
})

test('legacy dates, leap days, daily schedules and overnight intervals remain supported', () => {
  for (const reminder of [
    { id: 'legacy', title: 'Legacy', date: '2030-05-10T09:00' },
    { id: 'offset', title: 'Offset', date: '2030-05-10T09:00:00-03:00' },
    { id: 'date-only', title: 'Date', date: '2030-05-10' },
    {
      id: 'leap',
      title: 'Leap',
      date: '2028-02-29',
      schedule: 'all-day' as const,
    },
    {
      id: 'daily',
      title: 'Daily',
      date: '2030-05-10',
      schedule: 'time-range' as const,
      repeatTimes: ['20:00', '08:00'],
      endDate: '2030-05-12',
    },
    {
      id: 'overnight',
      title: 'Overnight',
      date: '2030-05-10',
      schedule: 'time-range' as const,
      startTime: '23:30',
      endDate: '2030-05-11',
      endTime: '00:30',
    },
  ]) {
    const value = { ...backup(), reminders: [reminder] }
    assert.deepEqual(parseNotebookBackup(JSON.stringify(value)), value)
  }
})
