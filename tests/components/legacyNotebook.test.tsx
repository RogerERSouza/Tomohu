import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { StrictMode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LegacyNotebookPanel } from '../../src/features/account/LegacyNotebookPanel'
import { STORAGE_KEY } from '../../src/lib/notebook'
import type { Notebook } from '../../src/types'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
const saved: Notebook = {
  schemaVersion: 1,
  sections: [],
  contents: [],
  reminders: [],
}

test('legacy data is not rewritten on mount and requires explicit copy consent', () => {
  const raw = JSON.stringify(saved, null, 3)
  localStorage.setItem(STORAGE_KEY, raw)
  const copies: Notebook[] = []
  const screen = render(
    <StrictMode>
      <LegacyNotebookPanel
        onCopy={async (value) => {
          copies.push(value)
        }}
      />
    </StrictMode>,
  )
  const copy = screen.getByRole('button', {
    name: 'Copiar dados anteriores para a conta',
  }) as HTMLButtonElement
  assert.equal(copy.disabled, true)
  assert.equal(localStorage.getItem(STORAGE_KEY), raw)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(copy)
  assert.deepEqual(copies, [saved])
  assert.equal(localStorage.getItem(STORAGE_KEY), raw)
})

test('invalid legacy data remains exportable without an account upload action', () => {
  localStorage.setItem(STORAGE_KEY, '{damaged')
  const screen = render(
    <LegacyNotebookPanel
      onCopy={async () => {
        throw new Error('Must not copy')
      }}
    />,
  )
  assert.ok(screen.getByRole('button', { name: 'Exportar dados anteriores' }))
  assert.equal(screen.queryByRole('checkbox'), null)
  assert.equal(localStorage.getItem(STORAGE_KEY), '{damaged')
})

test('a changed legacy source requires fresh consent before copying the latest snapshot', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const copies: Notebook[] = []
  const screen = render(
    <LegacyNotebookPanel
      onCopy={async (value) => {
        copies.push(value)
      }}
    />,
  )
  fireEvent.click(screen.getByRole('checkbox'))
  const updated = {
    ...saved,
    sections: [
      { id: 's', parentId: null, title: 'New', emoji: '', color: '#a7bcec' },
    ],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Copiar dados anteriores para a conta',
    }),
  )
  assert.equal(copies.length, 0)
  assert.equal(
    (screen.getByRole('checkbox') as HTMLInputElement).checked,
    false,
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Copiar dados anteriores para a conta',
    }),
  )
  assert.deepEqual(copies, [updated])
})
