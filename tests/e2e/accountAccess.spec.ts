import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Page } from '@playwright/test'
import type { Notebook } from '../../src/types'

async function server(page: Page) {
  let authenticated = false
  let copies = 0
  let snapshot: Notebook = structuredClone(fixture)
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ json, status })
    if (path === '/auth/browser/login') authenticated = true
    if (path === '/auth/browser/refresh' || path === '/auth/browser/login')
      return reply(
        authenticated
          ? { access_token: 'new-token', expires_in: 900, token_type: 'bearer' }
          : {},
        authenticated ? 200 : 401,
      )
    if (path === '/auth/browser/logout' || path === '/auth/logout') {
      authenticated = false
      return reply({})
    }
    if (path === '/auth/me')
      return reply({
        id: 'alice',
        email: 'alice@example.com',
        email_verified: true,
      })
    if (path === '/auth/browser/bootstrap' || path === '/notebooks/book')
      return reply({ id: 'book', revision: 1, snapshot })
    if (path === '/notebooks' && route.request().method() === 'POST') {
      copies++
      snapshot = route.request().postDataJSON().snapshot
      return reply({ id: 'copy', revision: 1, snapshot })
    }
    if (path === '/notebooks') return reply([{ id: 'book', revision: 1 }])
    if (path.startsWith('/privacy/notebooks/')) return reply([])
    return reply({}, 404)
  })
  return { copies: () => copies }
}
async function login(page: Page) {
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Account123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
}

test('login gate preserves and exports old data; copying requires explicit consent', async ({
  page,
}) => {
  const api = await server(page)
  await expect(
    page.getByRole('button', { name: 'Nova seção', exact: true }),
  ).toHaveCount(0)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveCount(0)
  const exported = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar dados anteriores', exact: true })
    .click()
  expect((await exported).suggestedFilename()).toBe(
    'tomohu-local-preserved.json',
  )
  await login(page)
  expect(api.copies()).toBe(0)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  const copy = page.getByRole('button', {
    name: 'Copiar dados anteriores para a conta',
    exact: true,
  })
  await expect(copy).toBeDisabled()
  await page
    .getByLabel(
      'Confirmo copiar os dados anteriores para esta conta, mantendo o original.',
    )
    .check()
  await copy.click()
  await expect.poll(api.copies).toBe(1)
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    ),
  ).toEqual(fixture)
})

test('renewal reopens the account and explicit logout returns to authentication', async ({
  page,
}) => {
  await server(page)
  await login(page)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Lembretes', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Tomohu', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Nova seção', exact: true }),
  ).toHaveCount(0)
})

test('loaded common data stays navigable but read-only during an outage', async ({
  page,
}) => {
  await server(page)
  await login(page)
  await page.context().setOffline(true)
  await expect(
    page.getByText('Sem conexão · somente leitura.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Nova seção', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: /Alpha.*itens/ }).click()
  await page.getByRole('button', { name: /Nota de teste.*Abrir nota/i }).click()
  await expect(page.getByLabel('Sua nota')).toBeDisabled()
  await page.context().setOffline(false)
  await expect(page.getByLabel('Sua nota')).toBeEnabled()
})
