import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Notebook } from '../../src/types'
import type { Page } from '@playwright/test'

const readNotebook = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!) as Notebook,
    storageKey,
  )
const openAlpha = async (page: Page) => {
  await page.getByRole('button', { name: /Alpha.*itens/ }).click()
  await expect(page).toHaveURL(/#section\/alpha$/)
}

test('legacy notebook, hash navigation, missing route and responsive columns', async ({
  page,
}, info) => {
  await openAlpha(page)
  await expect(page.getByRole('heading', { name: '📚 Alpha' })).toBeVisible()
  await expect(page.locator('.content-column')).toHaveCount(
    info.project.name === 'mobile' ? 1 : 2,
  )
  await page.getByRole('button', { name: /Nota de teste.*Abrir nota/i }).click()
  await expect(page.getByLabel('Sua nota')).toHaveValue('Texto pesquisável')
  await page.reload()
  await expect(page.getByLabel('Sua nota')).toHaveValue('Texto pesquisável')
  await page.goBack()
  await page.goto('/#section/missing')
  await expect(
    page.getByRole('heading', { name: 'Conteúdo não encontrado' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao início' }).click()
  await expect(
    page.getByRole('heading', { name: 'Lembretes', exact: true }),
  ).toBeVisible()
  expect((await readNotebook(page)).schemaVersion).toBe(1)
})

test('section validation, tags, free color, editing and cascading deletion', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Nova seção', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Criar seção', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Escreva o nome')
  await dialog.getByLabel('Nome da seção').fill('Nova seção de teste')
  await dialog.getByLabel(/^Emoji/).fill('⭐')
  await dialog.getByPlaceholder('Ex.: escola').fill('#Projeto')
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await dialog.getByLabel('Escolher outra cor').fill('#123456')
  await dialog.getByRole('button', { name: 'Criar seção', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Nova seção de teste', exact: true }),
  ).toBeVisible()
  const created = (await readNotebook(page)).sections.find(
    (section) => section.title === 'Nova seção de teste',
  )
  expect(created).toMatchObject({
    emoji: '⭐',
    color: '#123456',
    tags: ['projeto'],
  })
  await page.getByLabel('Configurar Nova seção de teste').click()
  await dialog.getByLabel('Nome da seção').fill('Renomeada')
  await dialog.getByLabel('Remover tag projeto').click()
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Renomeada', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Configurar Alpha').click()
  await dialog
    .getByRole('button', { name: 'Excluir seção', exact: true })
    .click()
  await expect(dialog.getByRole('alert')).toContainText('subseções')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Excluir seção', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Excluir seção', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Alpha', exact: true }),
  ).toHaveCount(0)
  const notebook = await readNotebook(page)
  expect(notebook.sections.some((s) => s.id === 'child')).toBe(false)
  expect(notebook.contents).toHaveLength(0)
})

test('sort, favorite, color/tag filters and menu dismissal', async ({
  page,
}) => {
  const titles = page.locator('.section-grid .section-card h3')
  await expect(titles).toHaveText(['Beta', 'Alpha'])
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.getByRole('button', { name: 'Mais antigas', exact: true }).click()
  await expect(titles).toHaveText(['Alpha', 'Beta'])
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.getByRole('button', { name: 'A–Z', exact: true }).click()
  await expect(titles).toHaveText(['Alpha', 'Beta'])
  await page.getByLabel('Fixar Beta no topo').click()
  await expect(titles).toHaveText(['Beta', 'Alpha'])
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).not.toBeVisible()
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.getByRole('heading', { name: 'Lembretes', exact: true }).click()
  await expect(page.getByRole('menu')).not.toBeVisible()
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.getByLabel('Filtrar pela cor #a7bcec').click()
  await expect(titles).toHaveText(['Alpha'])
  await page.getByRole('button', { name: 'Ordenar e filtrar' }).click()
  await page
    .locator('.sort-color-options')
    .getByRole('button', { name: 'Todas' })
    .click()
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click()
  await page.getByRole('button', { name: '#jogos', exact: true }).click()
  await expect(titles).toHaveText(['Beta'])
  await page.getByRole('button', { name: /Beta.*iten/ }).click()
  await page.getByRole('button', { name: 'Início', exact: true }).last().click()
  await expect(titles).toHaveCount(2)
})

test('global search opens note, list item, section tag and reminder', async ({
  page,
}) => {
  const search = page.getByLabel('Pesquisar em todo o Tomohu')
  await search.fill('pesquisável')
  await page.getByRole('button', { name: /Nota de teste/ }).click()
  await expect(page.getByLabel('Sua nota')).toBeVisible()
  await page.getByRole('button', { name: 'Início', exact: true }).last().click()
  await search.fill('Leite')
  await page.getByRole('button', { name: /Compras/ }).click()
  await expect(page.getByLabel('Item 1', { exact: true })).toHaveValue('Leite')
  await page.getByRole('button', { name: 'Início', exact: true }).last().click()
  await search.fill('estudo')
  await page.getByRole('button', { name: /Alpha/ }).click()
  await expect(page).toHaveURL(/#section\/alpha/)
  await page.getByRole('button', { name: 'Início', exact: true }).last().click()
  await search.fill('Evento futuro')
  await page
    .getByRole('button', { name: /Evento futuro/ })
    .last()
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Editar lembrete')
})

test('note creation, autosave, empty title fallback and deletion', async ({
  page,
}) => {
  await openAlpha(page)
  await page.getByRole('button', { name: 'Conteúdo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Escreva o título')
  await dialog.getByPlaceholder('O que você quer registrar?').fill('Nova nota')
  await dialog.getByRole('button', { name: 'Criar e abrir' }).click()
  await page.getByLabel('Sua nota').fill('Texto salvo na nota')
  await page.getByLabel('Título', { exact: true }).fill('')
  await page.getByLabel('Sua nota').focus()
  await expect(
    page.getByRole('heading', { name: 'Sem título', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Sua nota')).toHaveValue('Texto salvo na nota')
  await page
    .getByRole('button', { name: 'Excluir conteúdo', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('permanentemente')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Excluir conteúdo', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Excluir conteúdo', exact: true })
    .click()
  await expect(page).toHaveURL(/#section\/alpha$/)
})

test('checklist expansion, inline checkbox, item editing/reorder/removal and tutorial', async ({
  page,
}) => {
  await openAlpha(page)
  const card = page.locator('.content-card').filter({
    has: page.getByRole('heading', { name: 'Compras', exact: true }),
  })
  await card.locator('.content-summary').click()
  await card.getByLabel('Concluir Leite').check()
  await expect(card.locator('.content-summary')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await card.getByRole('button', { name: 'Abrir para editar' }).click()
  await expect(page.getByLabel('Concluir Leite')).toBeChecked()
  await page.getByLabel('Novo item', { exact: true }).fill('Arroz')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.getByLabel('Mover item 3 para cima').click()
  await expect(page.getByLabel('Item 2', { exact: true })).toHaveValue('Arroz')
  await page.getByLabel('Item 2', { exact: true }).fill('Arroz integral')
  await page.getByLabel('Excluir item 2', { exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('Item 2', { exact: true })).toHaveValue('Pão')
  await page.goto('/#content/tutorial')
  await page
    .getByLabel('Introdução ou tutorial em texto livre')
    .fill('Texto do tutorial')
  await page.getByLabel('Novo item', { exact: true }).fill('Segundo passo')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.getByLabel('Concluir Segundo passo').check()
  await page.reload()
  await expect(page.getByLabel('Passo 2', { exact: true })).toHaveValue(
    'Segundo passo',
  )
  await expect(page.getByLabel('Concluir Segundo passo')).toBeChecked()
})

test('counter inline controls, nonnegative total and immutable dated history', async ({
  page,
}) => {
  await openAlpha(page)
  await expect(page.getByLabel('Diminuir Água')).toBeDisabled()
  await page.getByLabel('Aumentar Água').click()
  await page.getByLabel('Diminuir Água').click()
  await expect(page.getByLabel('Diminuir Água')).toBeDisabled()
  await page.goto('/#content/counter')
  await expect(page.locator('.history-entry')).toHaveCount(2)
  await page
    .getByPlaceholder('Adicionar uma anotação…')
    .first()
    .fill('Correção')
  await page.getByLabel('Aumentar contagem').click()
  await page.reload()
  await expect(page.locator('.counter-detail output')).toHaveText('1')
  await expect(page.locator('.history-entry')).toHaveCount(3)
  await expect(
    page.getByPlaceholder('Adicionar uma anotação…').nth(1),
  ).toHaveValue('Correção')
})

test('preferences persist and modal Escape restores focus', async ({
  page,
}) => {
  const settings = page.getByRole('button', { name: 'Ajustes', exact: true })
  await settings.click()
  await page.getByRole('button', { name: 'Claro', exact: true }).click()
  await page
    .getByRole('button', { name: '12 horas (AM/PM)', exact: true })
    .click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(settings).toBeFocused()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await settings.click()
  await expect(
    page.getByRole('button', { name: '12 horas (AM/PM)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('backup download, invalid import, confirmation, cancellation and replacement', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cópia dos dados' }).click()
  const download = await downloaded
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(
    fixture,
  )
  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(page.getByRole('alert')).toContainText('backup JSON válido')
  const empty = { schemaVersion: 1, sections: [], contents: [], reminders: [] }
  const file = {
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(empty)),
  }
  await input.setInputFiles(file)
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Importar backup')
  expect((await readNotebook(page)).sections).toHaveLength(3)
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  expect((await readNotebook(page)).sections).toHaveLength(3)
  await input.setInputFiles(file)
  await page.getByRole('button', { name: 'Substituir dados' }).click()
  await page.reload()
  expect(await readNotebook(page)).toEqual(empty)
})

test('reminder title validation, Today selection, one-time event and removal', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Novo lembrete', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Salvar lembrete' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Escreva o título')
  await dialog
    .getByPlaceholder('O que você quer lembrar?')
    .fill('Lembrete pontual')
  await dialog.getByRole('button', { name: 'Ir para hoje' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Um horário', exact: true }).click()
  await dialog.getByRole('button', { name: '09:00', exact: true }).click()
  await dialog.getByRole('spinbutton', { name: 'Hora', exact: true }).fill('15')
  await dialog.getByRole('button', { name: 'Pronto', exact: true }).click()
  await dialog.getByRole('button', { name: 'Salvar lembrete' }).click()
  await page.getByRole('button', { name: /Lembrete pontual/ }).click()
  await expect(dialog).toHaveAccessibleName('Editar lembrete')
  await dialog
    .getByRole('button', { name: 'Concluir e remover lembrete' })
    .click()
  await expect(
    page.getByRole('button', { name: /Lembrete pontual/ }),
  ).toHaveCount(0)
})

test('multi-day schedules, duplicate warning, invalid date range and expired reminder', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Novo lembrete', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('O que você quer lembrar?').fill('Programado')
  await dialog.getByRole('button', { name: 'Vários dias', exact: true }).click()
  const end = dialog.getByRole('region', {
    name: 'Data de término',
    exact: true,
  })
  await end.getByRole('button', { name: '9', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('data de término')
  await end.getByRole('button', { name: '12', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Horários programados', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: '+ Adicionar horário', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: '+ Adicionar horário', exact: true })
    .click()
  await expect(dialog.getByRole('alert')).toContainText('2 horários iguais')
  await dialog.getByRole('button', { name: 'Salvar lembrete' }).click()
  const saved = (await readNotebook(page)).reminders.find(
    (r) => r.title === 'Programado',
  )
  expect(saved?.repeatTimes).toEqual(['09:00', '14:00'])
  await page.getByRole('button', { name: /Evento encerrado/ }).click()
  await expect(dialog).toHaveAccessibleName('Prazo encerrado')
  await dialog.getByRole('button', { name: 'Alterar data' }).click()
  await expect(dialog).toHaveAccessibleName('Editar lembrete')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Evento encerrado/ }).click()
  await dialog
    .getByRole('button', { name: 'Excluir lembrete', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Evento encerrado/ }),
  ).toHaveCount(0)
})

test('damaged browser data is preserved instead of overwritten', async ({
  page,
}) => {
  await page.evaluate(
    (key) => localStorage.setItem(key, '{damaged'),
    storageKey,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('salvamento foi pausado')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe('{damaged')
})

test('capture comparable home and section layouts', async ({ page }, info) => {
  const directory = process.env.VISUAL_CAPTURE_DIR
  if (directory) await mkdir(directory, { recursive: true })
  for (const view of ['home', 'section']) {
    if (view === 'section') await openAlpha(page)
    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    })
    await info.attach(view, { body: screenshot, contentType: 'image/png' })
    if (directory)
      await writeFile(
        `${directory}/${info.project.name}-${view}.png`,
        screenshot,
      )
  }
})

test('every content kind can be created and reopened', async ({ page }) => {
  await openAlpha(page)
  for (const kind of ['Checklist', 'Tutorial', 'Contador']) {
    await page.getByRole('button', { name: 'Conteúdo', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByPlaceholder('O que você quer registrar?')
      .fill(`Novo ${kind}`)
    await dialog.getByRole('radio', { name: kind, exact: true }).check()
    await dialog.getByRole('button', { name: 'Criar e abrir' }).click()
    await expect(
      page.getByRole('heading', { name: `Novo ${kind}`, exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue(
      `Novo ${kind}`,
    )
    await page.getByRole('button', { name: 'Voltar à seção' }).click()
  }
})

test('12-hour continuous schedule validates its end and calendar navigation stays in the form', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: '12 horas (AM/PM)', exact: true })
    .click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Novo lembrete', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('O que você quer lembrar?').fill('Intervalo')
  await dialog.getByRole('button', { name: 'Próximo mês' }).click()
  await dialog.getByRole('button', { name: 'Mês anterior' }).click()
  await dialog.getByRole('button', { name: 'Com duração', exact: true }).click()
  const end = dialog
    .locator('.time-picker')
    .filter({ hasText: 'Horário de término' })
  await end.getByRole('button').click()
  await dialog.getByRole('spinbutton', { name: 'Hora', exact: true }).fill('8')
  await expect(dialog.getByRole('alert')).toContainText('horário de término')
  await dialog.getByRole('button', { name: 'PM', exact: true }).click()
  await dialog.getByRole('button', { name: 'Pronto', exact: true }).click()
  await dialog.getByRole('button', { name: 'Salvar lembrete' }).click()
  const saved = (await readNotebook(page)).reminders.find(
    (r) => r.title === 'Intervalo',
  )
  expect(saved?.startTime).toBe('09:00')
  expect(saved?.endTime).toBe('20:00')
})

test('failed browser writes show an export recovery action and preserve existing saved data', async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'task.notebook.v1')
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByLabel('Fixar Alpha no topo').click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar')
  await expect(
    page.getByRole('button', { name: 'Exportar cópia', exact: true }),
  ).toBeVisible()
  expect(await readNotebook(page)).toEqual(fixture)
})
