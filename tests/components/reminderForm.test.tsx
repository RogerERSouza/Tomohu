import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReminderForm } from '../../src/features/reminders/ReminderForm'
import type { ReminderDraft } from '../../src/lib/reminders'

afterEach(cleanup)

test('multi-day selection rejects an inverted same-date interval and accepts an overnight event', async () => {
  const user = userEvent.setup()
  const saved: ReminderDraft[] = []
  render(
    <ReminderForm
      reminder={{
        id: 'r',
        title: 'Interval',
        date: '2030-05-10',
        endDate: '2030-05-10',
        duration: 'multi-day',
        schedule: 'time-range',
        startTime: '09:00',
        endTime: '08:00',
      }}
      hourFormat="24h"
      onSave={(value) => saved.push(value)}
      onRemove={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Salvar lembrete' }))
  assert.equal(saved.length, 0)
  assert.match(screen.getByRole('alert').textContent ?? '', /término/)
  await user.click(
    within(screen.getByRole('region', { name: 'Data de término' })).getByRole(
      'button',
      { name: '11' },
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Salvar lembrete' }))
  assert.equal(saved.length, 1)
  assert.equal(saved[0].endDate, '2030-05-11')
  assert.equal(saved[0].endTime, '08:00')
})

for (const occurrence of ['Um horário', 'Com duração']) {
  test(`editing an all-day reminder as ${occurrence} saves valid defaults`, async () => {
    const user = userEvent.setup()
    const saved: ReminderDraft[] = []
    render(
      <ReminderForm
        reminder={{
          id: 'r',
          title: 'Event',
          date: '2030-05-12',
          schedule: 'all-day',
        }}
        hourFormat="24h"
        onSave={(draft) => saved.push(draft)}
        onRemove={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: occurrence }))
    await user.click(screen.getByRole('button', { name: 'Salvar lembrete' }))
    assert.equal(saved.length, 1)
    assert.equal(saved[0].startTime, '09:00')
    assert.equal(
      saved[0].endTime,
      occurrence === 'Com duração' ? '10:00' : undefined,
    )
  })
}
