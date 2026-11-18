import './setup.ts'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LegacyNotebookPanel } from '../../src/features/account/LegacyNotebookPanel'
import { STORAGE_KEY } from '../../src/lib/notebook'

test('failed legacy re-read must retain an actionable error and recovery', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      sections: [],
      contents: [],
      reminders: [],
    }),
  )
  const screen = render(
    <LegacyNotebookPanel
      onCopy={async () => {
        throw new Error('No upload expected')
      }}
    />,
  )
  fireEvent.click(screen.getByRole('checkbox'))
  mock.method(Object.getPrototypeOf(localStorage), 'getItem', () => {
    throw new Error('Storage temporarily blocked')
  })
  try {
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Copiar dados anteriores para a conta',
      }),
    )
    assert.ok(
      screen.queryByRole('alert'),
      'Storage read error must remain visible instead of silently removing the panel',
    )
  } finally {
    mock.restoreAll()
    cleanup()
    localStorage.clear()
  }
})
