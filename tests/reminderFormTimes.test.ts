import assert from 'node:assert/strict'
import test from 'node:test'
import { getInitialReminderTimes } from '../src/features/reminders/reminderFormTimes.ts'

test('new and date-only reminders initialize valid timed-event defaults', () => {
  const defaults = { startTime: '09:00', endTime: '10:00' }
  assert.deepEqual(getInitialReminderTimes(), defaults)
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'All day',
      date: '2030-05-12',
      schedule: 'all-day',
    }),
    defaults,
  )
})

test('legacy, explicit and midnight reminder times are preserved', () => {
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'Legacy',
      date: '2030-05-12T08:35',
    }),
    { startTime: '08:35', endTime: '09:35' },
  )
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'Explicit',
      date: '2030-05-12',
      startTime: '14:30',
      endTime: '18:45',
    }),
    { startTime: '14:30', endTime: '18:45' },
  )
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'Midnight',
      date: '2030-05-12',
      startTime: '00:00',
    }),
    { startTime: '00:00', endTime: '01:00' },
  )
})

test('empty or invalid stored times recover without discarding a valid start time', () => {
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'Invalid',
      date: '2030-05-12',
      startTime: '',
      endTime: '99:99',
    }),
    { startTime: '09:00', endTime: '10:00' },
  )
  assert.deepEqual(
    getInitialReminderTimes({
      id: 'r',
      title: 'Evening',
      date: '2030-05-12',
      startTime: '23:30',
      endTime: '',
    }),
    { startTime: '23:30', endTime: '00:30' },
  )
})
