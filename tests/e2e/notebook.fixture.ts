import { test as base, expect } from '@playwright/test'
import type { Notebook } from '../../src/types'

export const storageKey = 'task.notebook.v1'
export const fixture: Notebook = {
  schemaVersion: 1,
  sections: [
    {
      id: 'alpha',
      parentId: null,
      title: 'Alpha',
      emoji: '📚',
      color: '#a7bcec',
      tags: ['estudo'],
    },
    {
      id: 'beta',
      parentId: null,
      title: 'Beta',
      emoji: '🎮',
      color: '#edcf94',
      tags: ['jogos'],
    },
    {
      id: 'child',
      parentId: 'alpha',
      title: 'Subseção',
      emoji: '📁',
      color: '#b4cbb3',
    },
  ],
  contents: [
    {
      id: 'note',
      sectionId: 'alpha',
      title: 'Nota de teste',
      kind: 'note',
      text: 'Texto pesquisável',
    },
    {
      id: 'list',
      sectionId: 'alpha',
      title: 'Compras',
      kind: 'checklist',
      items: [
        { id: 'one', text: 'Leite', completed: false },
        { id: 'two', text: 'Pão', completed: true },
      ],
    },
    {
      id: 'tutorial',
      sectionId: 'alpha',
      title: 'Tutorial de teste',
      kind: 'tutorial',
      text: 'Introdução',
      items: [{ id: 'step', text: 'Primeiro passo', completed: false }],
    },
    {
      id: 'counter',
      sectionId: 'alpha',
      title: 'Água',
      kind: 'counter',
      entries: [],
    },
  ],
  reminders: [
    {
      id: 'future',
      title: 'Evento futuro',
      date: '2030-05-12',
      schedule: 'all-day',
      duration: 'single-day',
    },
    {
      id: 'expired',
      title: 'Evento encerrado',
      date: '2020-01-01',
      schedule: 'all-day',
      duration: 'single-day',
    },
  ],
}

export const test = base.extend({
  page: async ({ page }, run) => {
    await page.clock.install({ time: new Date('2030-05-10T12:00:00Z') })
    await page.addInitScript(
      ({ notebook, key }) => {
        // Seed once per isolated browser context; reloads must exercise persistence.
        if (!sessionStorage.getItem('test-seeded')) {
          localStorage.setItem(key, JSON.stringify(notebook))
          sessionStorage.setItem('test-seeded', 'true')
        }
        Object.defineProperty(document, 'startViewTransition', {
          value: undefined,
        })
      },
      { notebook: fixture, key: storageKey },
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Lembretes', exact: true }),
    ).toBeVisible()
    await run(page)
    expect(errors).toEqual([])
  },
})
export { expect }
