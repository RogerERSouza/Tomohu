import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Notebook } from '../../src/types'

test('inconsistent imports preserve current data and leave editing and deletion usable', async ({
  page,
}) => {
  const cases: Array<(value: Notebook) => void> = [
    (value) => {
      value.reminders[0].date = 'not-a-date'
    },
    (value) => {
      value.reminders[0].date = '2030-02-30'
    },
    (value) => {
      value.reminders[0].startTime = '99:99'
    },
    (value) => {
      value.sections[1].id = 'alpha'
    },
    (value) => {
      value.sections[0].parentId = 'child'
    },
    (value) => {
      value.contents[0].sectionId = 'missing'
    },
    (value) => {
      const counter = value.contents.find(
        (content) => content.kind === 'counter',
      )
      if (counter?.kind !== 'counter') throw new Error('Expected counter')
      counter.entries = [
        {
          id: 'negative',
          delta: -2,
          createdAt: '2030-05-10T09:00:00Z',
          note: '',
        },
      ]
    },
  ]
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  for (const invalidate of cases) {
    const invalid = structuredClone(fixture)
    invalidate(invalid)
    await page.locator('input[type=file]').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(invalid)),
    })
    await expect(page.getByRole('alert')).toContainText('backup JSON válido')
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Ajustes')
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
        storageKey,
      ),
    ).toEqual(fixture)
  }
  await page.keyboard.press('Escape')
  await page.goto('/#content/counter')
  await page.getByLabel('Aumentar contagem').click()
  await expect(page.locator('.counter-detail output')).toHaveText('1')
  await page.reload()
  await expect(page.locator('.counter-detail output')).toHaveText('1')
  await page.goto('/')
  await page.getByLabel('Configurar Alpha').click()
  await page.getByRole('button', { name: 'Excluir seção', exact: true }).click()
  await page.getByRole('button', { name: 'Excluir seção', exact: true }).click()
  await expect(page.getByLabel('Configurar Beta')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Configurar Beta')).toBeVisible()
  await expect(page.getByLabel('Configurar Alpha')).toHaveCount(0)
})

test('a reversed same-date continuous event is blocked and a corrected overnight event persists', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Novo lembrete', exact: true }).click()
  await page
    .getByPlaceholder('O que você quer lembrar?')
    .fill('Overnight validation')
  await page.getByRole('button', { name: 'Vários dias', exact: true }).click()
  await page.getByRole('button', { name: 'Contínuo', exact: true }).click()
  await page
    .locator('.time-picker')
    .filter({ hasText: 'Horário de término' })
    .getByRole('button')
    .click()
  await page.getByRole('spinbutton', { name: 'Hora', exact: true }).fill('8')
  await page.getByRole('button', { name: 'Pronto', exact: true }).click()
  await page
    .getByRole('button', { name: 'Salvar lembrete', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('término')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      storageKey,
    ),
  ).toEqual(fixture)
  await page
    .getByRole('region', { name: 'Data de término', exact: true })
    .getByRole('button', { name: '11', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Salvar lembrete', exact: true })
    .click()
  await page.reload()
  await page.getByRole('button', { name: /Overnight validation/ }).click()
  await expect(
    page.getByRole('button', { name: '09:00', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '08:00', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Concluir e remover lembrete', exact: true })
    .click()
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Overnight validation/ }),
  ).toHaveCount(0)
})
