import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Page } from '@playwright/test'

const origin = 'http://127.0.0.1:8000'
const accountKey = 'tomohu.account.v1.alice.book'

async function mockAccount(page: Page, logoutStatus: number) {
  const controls = { verified: false, meStatus: 200 }
  await page.route(`${origin}/api/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    const reply = (value: unknown, status = 200) =>
      route.fulfill({ status, json: value })
    if (path.endsWith('/login'))
      return reply({
        access_token: 'review-token',
        token_type: 'bearer',
        expires_in: 900,
      })
    if (path.endsWith('/me'))
      return reply(
        {
          id: 'alice',
          email: 'alice@example.com',
          email_verified: controls.verified,
        },
        controls.meStatus,
      )
    if (path.endsWith('/notebooks')) return reply([{ id: 'book', revision: 1 }])
    if (path.endsWith('/notebooks/book'))
      return reply({ id: 'book', revision: 1, snapshot: fixture })
    if (path.endsWith('/logout')) {
      if (logoutStatus === 0) return route.abort('failed')
      return reply({ message: 'Ended' }, logoutStatus)
    }
    return reply({}, 404)
  })
  return controls
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
}
async function login(page: Page) {
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('ReviewPassword123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
}
async function openBook(page: Page) {
  await page.getByLabel('Caderno da conta').selectOption('book')
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
}

for (const status of [0, 503, 401])
  test(`logout ${status} exits locally and preserves both guest data and account drafts`, async ({
    page,
  }) => {
    await mockAccount(page, status)
    await settings(page)
    await login(page)
    await openBook(page)
    await page.goto('/#content/note')
    await page.getByLabel('Sua nota').fill('Unsynced account draft')
    const cached = await page.evaluate(
      (key) => localStorage.getItem(key),
      accountKey,
    )
    expect(cached).toContain('Unsynced account draft')
    await settings(page)
    await page
      .getByRole('button', { name: 'Sair e voltar ao caderno local' })
      .click()
    await expect(
      page.getByText('Caderno da conta ·', { exact: false }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Conectado como', { exact: false }),
    ).toHaveCount(0)
    if (status !== 401) {
      await expect(page.getByRole('status')).toContainText(
        'Não foi possível confirmar o encerramento no servidor',
      )
    } else {
      await expect(
        page.getByText(
          'Não foi possível confirmar o encerramento no servidor',
          { exact: false },
        ),
      ).toHaveCount(0)
    }
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
        storageKey,
      ),
    ).toEqual(fixture)
    expect(
      await page.evaluate((key) => localStorage.getItem(key), accountKey),
    ).toBe(cached)
    await page.goto('/#content/note')
    await expect(page.getByLabel('Sua nota')).toHaveValue('Texto pesquisável')
    await settings(page)
    await login(page)
    await openBook(page)
    await page.goto('/#content/note')
    await expect(page.getByLabel('Sua nota')).toHaveValue(
      'Unsynced account draft',
    )
  })

test('refreshed verification survives reopening settings and an expired refresh keeps the account draft', async ({
  page,
}) => {
  const controls = await mockAccount(page, 200)
  await settings(page)
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Pending verified account draft')
  await settings(page)
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await expect(
    page.getByText('E-mail ainda não verificado.', { exact: true }),
  ).toBeVisible()
  controls.verified = true
  await page
    .getByRole('button', { name: 'Atualizar confirmação', exact: true })
    .click()
  await expect(
    page.getByText('E-mail verificado.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Segurança da conta', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await settings(page)
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await expect(
    page.getByText('E-mail verificado.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Reenviar confirmação de e-mail' }),
  ).toHaveCount(0)
  controls.meStatus = 401
  await page
    .getByRole('button', { name: 'Atualizar confirmação', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toContainText('sessão encerrada')
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Pending verified account draft',
  )
})
