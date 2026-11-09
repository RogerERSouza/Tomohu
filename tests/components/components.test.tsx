import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SectionCard } from '../../src/features/sections/SectionCard'
import { ContentEditor } from '../../src/features/contents/ContentEditor'
import { Modal } from '../../src/components/Modal'
import type { Content, Section } from '../../src/types'

afterEach(cleanup)

test('section actions remain separate and expose the favorite state', async () => {
  const user = userEvent.setup()
  let opened = 0
  let edited = 0
  function Example() {
    const [section, setSection] = useState<Section>({
      id: 's',
      parentId: null,
      title: 'Alpha',
      emoji: '',
      color: '#a7bcec',
    })
    return (
      <SectionCard
        section={section}
        count={1}
        onOpen={() => opened++}
        onEdit={() => edited++}
        onToggleFavorite={() =>
          setSection({ ...section, favorite: !section.favorite })
        }
      />
    )
  }
  render(<Example />)
  await user.click(screen.getByRole('button', { name: 'Fixar Alpha no topo' }))
  assert.equal(
    screen
      .getByRole('button', { name: 'Remover Alpha dos favoritos' })
      .getAttribute('aria-pressed'),
    'true',
  )
  assert.equal(opened, 0)
  await user.click(screen.getByRole('button', { name: 'Configurar Alpha' }))
  assert.equal(edited, 1)
  await user.click(screen.getByRole('button', { name: /Alpha.*1 item/ }))
  assert.equal(opened, 1)
})

test('list editor adds, moves, edits and checks items without losing their identities', async () => {
  const user = userEvent.setup()
  let latest: Content | undefined
  function Example() {
    const [content, setContent] = useState<Content>({
      id: 'c',
      sectionId: 's',
      title: 'Lista',
      kind: 'checklist',
      items: [{ id: 'original', text: 'Primeiro', completed: false }],
    })
    latest = content
    return (
      <ContentEditor
        content={content}
        onChange={setContent}
        onCount={() => {}}
        onRemove={() => {}}
        hourFormat="24h"
      />
    )
  }
  render(<Example />)
  await user.type(screen.getByLabelText('Novo item'), 'Segundo')
  await user.click(screen.getByRole('button', { name: 'Adicionar' }))
  await user.click(
    screen.getByRole('button', { name: 'Mover item 2 para cima' }),
  )
  await user.click(screen.getByLabelText('Concluir Primeiro'))
  assert.equal(latest?.kind, 'checklist')
  if (latest?.kind !== 'checklist') throw new Error('Expected checklist')
  assert.equal(latest.items[1].id, 'original')
  assert.equal(latest.items[1].completed, true)
  await user.clear(screen.getByLabelText('Item 1'))
  await user.type(screen.getByLabelText('Item 1'), 'Renomeado')
  assert.equal(latest.items[0].text, 'Renomeado')
})

test('modal close restores focus to the original trigger', async () => {
  const user = userEvent.setup()
  function Example() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        {open && (
          <Modal title="Teste" onClose={() => setOpen(false)}>
            <p>Conteúdo</p>
          </Modal>
        )}
      </>
    )
  }
  render(<Example />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  assert.ok(screen.getByRole('dialog', { name: 'Teste' }))
  await user.click(screen.getByRole('button', { name: 'Fechar' }))
  assert.equal(screen.queryByRole('dialog'), null)
  assert.equal(
    document.activeElement,
    screen.getByRole('button', { name: 'Abrir' }),
  )
})
