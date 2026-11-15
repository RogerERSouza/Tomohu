import type { Page } from '@playwright/test'
import { test, expect, fixture } from './notebook.fixture'
import type { Notebook } from '../../src/types'

async function openPrivate(page: Page, options: { failWrites?: boolean } = {}) {
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
  await page.route('http://127.0.0.1:8000/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json })
    if (path === '/auth/login')
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
    if (path === '/notebooks')
      return reply([
        { id: 'book', revision: 1 },
        { id: 'second', revision: 1 },
      ])
    if (path === '/notebooks/book')
      return reply({ id: 'book', revision: 1, snapshot: publicSnapshot })
    if (path === '/privacy/notebooks/book')
      return reply([
        {
          id: 'p',
          root_id: 'alpha',
          kind: 'section',
          parent_id: null,
          position: 0,
          title: 'Alpha',
        },
      ])
    if (path === '/privacy/unlock')
      return reply({ token: 'grant', expires_in: 300 })
    if (path === '/privacy/notebooks/book/p') {
      if (req.method() === 'PUT') {
        if (options.failWrites) return reply({}, 409)
        const next: Notebook = req.postDataJSON().snapshot
        if (next.contents.some((c) => !c.title)) return reply({}, 422)
        privateSnapshot = next
      }
      return reply({ snapshot: privateSnapshot, revision: 2 })
    }
    return reply({}, 404)
  })
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Account123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
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
  await page.getByRole('button', { name: 'Seção privada', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Private123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  return { snapshot: () => privateSnapshot }
}

test('private autosave resumes after a temporarily empty inline title', async ({
  page,
}) => {
  const server = await openPrivate(page)
  await page.goto('/#content/note')
  const title = page.getByLabel('Título', { exact: true })
  await title.fill('')
  await page.clock.runFor(1000)
  expect(server.snapshot().contents.find((c) => c.id === 'note')?.title).toBe(
    'Nota de teste',
  )
  await expect(
    page.getByRole('button', { name: 'Tentar salvar novamente', exact: true }),
  ).toHaveCount(0)
  await title.fill('Valid replacement')
  await page.getByLabel('Sua nota').click()
  await page.clock.runFor(1000)
  await expect
    .poll(() => server.snapshot().contents.find((c) => c.id === 'note')?.title)
    .toBe('Valid replacement')
})

test('expired private access preserves the draft and blocks workspace changes', async ({
  page,
}) => {
  await openPrivate(page, { failWrites: true })
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Retained draft in first book')
  await expect(
    page.getByRole('button', { name: 'Exportar rascunho', exact: true }),
  ).toBeVisible()
  await page.clock.fastForward(300001)
  await expect(page.getByLabel('Sua nota')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(
    page.getByLabel('Caderno da conta', { exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', {
      name: 'Sair e voltar ao caderno local',
      exact: true,
    }),
  ).toBeDisabled()
  await page.clock.fastForward(600001)
  await expect(page.getByLabel('E-mail', { exact: true })).toBeEnabled()
  await page.getByLabel('E-mail', { exact: true }).fill('other@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Owner123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(
    page.getByText(
      'Entre na mesma conta para recuperar o rascunho privado antes de trocar de conta.',
    ),
  ).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Owner123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await expect(
    page.getByLabel('Caderno da conta', { exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page.goto('/#section/alpha')
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Private123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Retained draft in first book',
  )
})
