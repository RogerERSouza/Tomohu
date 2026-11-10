import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPicker } from '../../src/components/CalendarPicker'

afterEach(cleanup)

test('an invalid calendar value renders a usable month and can be replaced', async () => {
  const selected: string[] = []
  const user = userEvent.setup()
  render(
    <CalendarPicker
      value="not-a-date"
      onChange={(date) => selected.push(date)}
    />,
  )
  assert.ok(screen.getByRole('grid', { name: 'Dias do mês' }))
  await user.click(screen.getByRole('button', { name: 'Ir para hoje' }))
  assert.equal(selected.length, 1)
  assert.match(selected[0], /^\d{4}-\d{2}-\d{2}$/)
  await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
  assert.ok(screen.getByRole('button', { name: '1' }))
})
