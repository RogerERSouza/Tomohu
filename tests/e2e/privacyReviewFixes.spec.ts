import type { Page } from '@playwright/test'
import { test, expect, fixture } from './notebook.fixture'
import type { Notebook } from '../../src/types'

async function openPrivate(
  page: Page,
  options: {
    holdRestore?: boolean
    holdSwitch?: boolean
    failAfterRestore?: boolean
    failInitialList?: boolean
  } = {},
) {
  const ids = new Set(['alpha', 'child'])
  let privateSnapshot: Notebook = {
    schemaVersion: 1,
    sections: structuredClone(fixture.sections.filter((s) => ids.has(s.id))),
    contents: structuredClone(fixture.contents),
    reminders: [],
  }
  const publicSnapshot: Notebook = {
    ...structuredClone(fixture),
    sections: fixture.sections.filter((s) => !ids.has(s.id)),
    contents: [],
  }
  let restored = false
  let committed: Notebook | null = null
  let restoring = false
  let listRequests = 0
  let bookRequests = 0
  let switching = false
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('http://127.0.0.1:8000/api/v1/**', async (route) => {
    const req = route.request()
    let path = new URL(req.url()).pathname.replace('/api/v1', '')
    if (path === '/auth/browser/bootstrap') path = '/notebooks/book'
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json })
    if (path === '/auth/browser/login')
      return reply({
        access_token: 'token',
        expires_in: 900,
        token_type: 'bearer',
      })
    if (path === '/auth/me')
      return reply({
        id: 'owner',
        email: 'owner@example.com',
        email_verified: true,
      })
    if (path === '/notebooks') return reply([{ id: 'book', revision: 1 }])
    if (path === '/notebooks/book') {
      bookRequests++
      if (options.holdSwitch && bookRequests > 2) {
        switching = true
        await held
      }
      return reply({
        id: 'book',
        revision: restored ? 2 : 1,
        snapshot: committed ?? publicSnapshot,
      })
    }
    if (path === '/privacy/notebooks/book') {
      listRequests++
      if (
        (options.failInitialList && listRequests === 1) ||
        (restored && options.failAfterRestore)
      )
        return reply({}, 503)
      return reply(
        restored
          ? []
          : [
              {
                id: 'p',
                root_id: 'alpha',
                kind: 'section',
                parent_id: null,
                position: 0,
                title: 'Alpha',
              },
            ],
      )
    }
    if (path === '/privacy/unlock')
      return reply({ token: 'grant', expires_in: 300 })
    if (path === '/privacy/notebooks/book/p') {
      if (req.method() === 'PUT') {
        const next: Notebook = req.postDataJSON().snapshot
        if (next.contents.some((c) => !c.title)) return reply({}, 422)
        privateSnapshot = next
      }
      return reply({ snapshot: privateSnapshot, revision: 2 })
    }
    if (path === '/privacy/notebooks/book/p/restore') {
      committed = {
        ...structuredClone(publicSnapshot),
        sections: [
          ...publicSnapshot.sections,
          ...structuredClone(privateSnapshot.sections),
        ],
        contents: structuredClone(privateSnapshot.contents),
      }
      restoring = true
      if (options.holdRestore) await held
      restored = true
      return reply({
        notebook: { id: 'book', revision: 2, snapshot: committed },
      })
    }
    return reply({}, 404)
  })
  if (await page.getByRole('button', { name: 'Ajustes', exact: true }).count())
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Account123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  if (
    !(await page.getByRole('dialog', { name: 'Ajustes', exact: true }).count())
  )
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByLabel('Caderno da conta').selectOption('book')
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await expect(
    page.getByText('Caderno da conta · última versão carregada', {
      exact: true,
    }),
  ).toBeVisible()
  if (!options.failInitialList) {
    await page
      .getByRole('button', { name: 'Seção privada', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
      .fill('Private123')
    await page.getByRole('button', { name: 'Acessar', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
    ).toHaveCount(0)
  }
  return {
    release,
    isRestoring: () => restoring,
    snapshot: () => privateSnapshot,
    publicSnapshot: () => committed,
    listRequests: () => listRequests,
    isSwitching: () => switching,
  }
}

test('restoring locks the whole form until the submitted private changes are public', async ({
  page,
}) => {
  const server = await openPrivate(page, { holdRestore: true })
  await page.getByRole('button', { name: 'Editar seção', exact: true }).click()
  await page.getByLabel('Nome da seção', { exact: true }).fill('Updated root')
  await page.getByLabel('Seção privada', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await expect.poll(server.isRestoring).toBe(true)
  await expect(page.getByLabel('Nome da seção', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Salvar alterações', exact: true }),
  ).toBeDisabled()
  const dialog = page.getByRole('dialog', { name: 'Editar seção', exact: true })
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  server.release()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByText('Caderno da conta · última versão carregada', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Updated root$/, level: 1 }),
  ).toBeVisible()
  expect(JSON.stringify(server.publicSnapshot())).toContain('Updated root')
})

test('a failed metadata refresh cannot undo a committed public restoration in the UI or cache', async ({
  page,
}) => {
  await openPrivate(page, { failAfterRestore: true })
  await page.getByRole('button', { name: 'Editar seção', exact: true }).click()
  await page.getByLabel('Seção privada', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Editar seção', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: /Alpha$/, level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Não foi possível atualizar os itens privados.',
  )
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('tomohu.account.v1.owner.book')),
    )
    .toContain('Texto pesquisável')
})

test('failed private listing stays visible as an error and can be retried without reloading', async ({
  page,
}) => {
  const server = await openPrivate(page, { failInitialList: true })
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Eles não foram apagados',
  )
  await page
    .getByRole('main')
    .getByRole('button', {
      name: 'Tentar carregar itens privados novamente',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Seção privada', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(server.listRequests()).toBe(2)
})

test('private content settings normalize an empty title before autosaving', async ({
  page,
}) => {
  const server = await openPrivate(page)
  await page
    .getByRole('button', { name: 'Configurar Nota de teste', exact: true })
    .click()
  await page.getByLabel('Título', { exact: true }).fill('   ')
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await expect
    .poll(() => server.snapshot().contents.find((c) => c.id === 'note')?.title)
    .toBe('Sem título')
  await expect(
    page.getByText('Item privado salvo na conta', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('private import is disabled with guidance and public import remains available', async ({
  page,
}) => {
  await openPrivate(page)
  if (await page.getByRole('button', { name: 'Ajustes', exact: true }).count())
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Importar cópia dos dados', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText('Para importar uma cópia, volte ao caderno comum.', {
      exact: false,
    }),
  ).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  })
  await expect(
    page.getByRole('dialog', { name: 'Importar backup', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page
    .getByRole('navigation', { name: 'Localização' })
    .getByRole('button', { name: 'Início', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Seção privada', exact: true }),
  ).toBeVisible()
  if (await page.getByRole('button', { name: 'Ajustes', exact: true }).count())
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Importar cópia dos dados', exact: true }),
  ).toBeEnabled()
})

test('account notebook requests also lock the private settings dialog until completion', async ({
  page,
}) => {
  const server = await openPrivate(page, { holdSwitch: true })
  if (await page.getByRole('button', { name: 'Ajustes', exact: true }).count())
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('Caderno da conta').selectOption('book')
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await expect.poll(server.isSwitching).toBe(true)
  const dialog = page.getByRole('dialog', { name: 'Ajustes', exact: true })
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  server.release()
  await expect(
    page.getByText('Caderno da conta · última versão carregada', {
      exact: true,
    }),
  ).toBeVisible()
})
