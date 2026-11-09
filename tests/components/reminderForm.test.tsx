import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReminderForm } from '../../src/features/reminders/ReminderForm'
import type { ReminderDraft } from '../../src/lib/reminders'

afterEach(cleanup)

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
