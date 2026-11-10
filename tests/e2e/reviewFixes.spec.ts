import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Page } from '@playwright/test'
import type { Notebook } from '../../src/types'

const readNotebook = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as Notebook,
    storageKey,
  )

const upload = (page: Page, notebook: Notebook, name = 'backup.json') =>
  page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(notebook)),
  })

test('successful recovery resumes autosave before the next reload', async ({
  page,
}) => {
  await page.evaluate(
    (key) => localStorage.setItem(key, '{damaged'),
    storageKey,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('salvamento foi pausado')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await upload(page, fixture)
  await page.getByRole('button', { name: 'Substituir dados' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Editado após recuperar o backup')
  await expect
    .poll(async () =>
      (await readNotebook(page)).contents.find(
        (content) => content.id === 'note',
      ),
    )
    .toMatchObject({ text: 'Editado após recuperar o backup' })
  await page.reload()
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Editado após recuperar o backup',
  )
})

for (const occurrence of ['Um horário', 'Com duração']) {
  test(`converting an all-day event to ${occurrence} keeps valid saved times`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Evento futuro/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: occurrence, exact: true }).click()
    await expect(
      dialog.getByRole('button', { name: '09:00', exact: true }),
    ).toBeVisible()
    if (occurrence === 'Com duração')
      await expect(
        dialog.getByRole('button', { name: '10:00', exact: true }),
      ).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar lembrete' }).click()
    const reminder = (await readNotebook(page)).reminders.find(
      (item) => item.id === 'future',
    )
    expect(reminder?.startTime).toBe('09:00')
    expect(reminder?.endTime).toBe(
      occurrence === 'Com duração' ? '10:00' : undefined,
    )
    await page.reload()
    const card = page.getByRole('button', { name: /Evento futuro/ })
    await expect(card).not.toContainText(/Data inválida/i)
    await card.click()
    await expect(
      dialog.getByRole('button', { name: '09:00', exact: true }),
    ).toBeVisible()
  })
}

test('invalid counter-history imports are rejected without replacing the notebook', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  for (const createdAt of ['not-a-date', '999999-01-01T00:00:00Z']) {
    const invalid = structuredClone(fixture)
    const counter = invalid.contents.find((content) => content.id === 'counter')
    if (counter?.kind !== 'counter') throw new Error('Counter fixture missing')
    counter.entries = [{ id: 'invalid-entry', delta: 1, note: '', createdAt }]
    await upload(page, invalid, 'invalid-history.json')
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Ajustes')
    await expect(page.getByRole('alert')).toContainText('backup JSON válido')
    expect(await readNotebook(page)).toEqual(fixture)
  }
  await page.keyboard.press('Escape')
  await page.goto('/#content/counter')
  await expect(
    page.getByRole('heading', { name: 'Água', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.counter-detail output')).toHaveText('0')
})

for (const theme of ['Escuro', 'Claro']) {
  test(`section tags stay usable within narrow dialogs in ${theme}`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
    await page.getByRole('button', { name: theme, exact: true }).click()
    await page.keyboard.press('Escape')
    for (const width of [320, 360, 760]) {
      await page.setViewportSize({ width, height: 780 })
      for (const editing of [false, true]) {
        if (editing) await page.getByLabel('Configurar Alpha').click()
        else
          await page
            .getByRole('button', { name: 'Nova seção', exact: true })
            .click()
        const dialog = page.getByRole('dialog')
        const bounds = await dialog.evaluate((element) => {
          const row = element.querySelector('.tag-input-row')
          const action = row?.querySelector('button')
          const input = row?.querySelector('input')
          if (!row || !action || !input) throw new Error('Tag controls missing')
          const rect = element.getBoundingClientRect()
          const padding = Number.parseFloat(
            getComputedStyle(element).paddingRight,
          )
          return {
            right: rect.right - padding,
            rowRight: row.getBoundingClientRect().right,
            actionRight: action.getBoundingClientRect().right,
            inputWidth: input.getBoundingClientRect().width,
            horizontalOverflow: element.scrollWidth - element.clientWidth,
          }
        })
        expect(bounds.rowRight).toBeLessThanOrEqual(bounds.right + 1)
        expect(bounds.actionRight).toBeLessThanOrEqual(bounds.right + 1)
        expect(bounds.horizontalOverflow).toBeLessThanOrEqual(1)
        expect(bounds.inputWidth).toBeGreaterThan(40)
        await dialog.getByPlaceholder('Ex.: escola').fill('revisao')
        await dialog
          .getByRole('button', { name: 'Adicionar', exact: true })
          .click()
        await expect(dialog.getByLabel('Remover tag revisao')).toBeVisible()
        await dialog
          .getByRole('button', { name: 'Fechar', exact: true })
          .click()
      }
    }
  })
}
