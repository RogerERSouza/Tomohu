import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, fixture } from './notebook.fixture'

test('real privacy separation, private save, verified-email recovery and public restore preserve data', async ({
  page,
}) => {
  test.skip(
    process.env.TOMOHU_LIVE_API !== '1',
    'Requires the isolated privacy API and mail worker',
  )
  test.setTimeout(90000)
  const email = `private-${randomUUID()}@example.com`
  const password = 'Account123'
  const api = 'http://127.0.0.1:8000/api/v1'
  const request = page.request
  expect(
    (
      await request.post(api + '/auth/register', { data: { email, password } })
    ).status(),
  ).toBe(201)
  const auth = await (
    await request.post(api + '/auth/login', { data: { email, password } })
  ).json()
  const headers = { Authorization: `Bearer ${auth.access_token}` }
  const book = await (
    await request.post(api + '/notebooks', {
      headers,
      data: { snapshot: fixture },
    })
  ).json()
  async function mail(purpose: string) {
    let link = ''
    await expect
      .poll(
        async () => {
          let files: string[]
          try {
            files = await readdir(process.env.TOMOHU_MAIL_OUTBOX ?? '')
          } catch {
            return false
          }
          for (const file of files) {
            const value = (
              await readFile(
                join(process.env.TOMOHU_MAIL_OUTBOX ?? '', file),
                'utf8',
              )
            ).replace(/=\r?\n/g, '')
            if (!value.includes(`To: ${email}`)) continue
            const found = value.match(
              new RegExp(
                `http://127\\.0\\.0\\.1:4173/#account/${purpose}/[a-zA-Z0-9.-]+`,
              ),
            )
            if (found) {
              link = found[0]
              return true
            }
          }
          return false
        },
        { timeout: 20000 },
      )
      .toBe(true)
    return link
  }
  await page.goto(await mail('verify'))
  await page
    .getByRole('button', { name: 'Confirmar meu e-mail', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('E-mail confirmado')
  await page
    .getByRole('button', { name: 'Voltar ao caderno', exact: true })
    .click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByLabel('Caderno da conta').selectOption(book.id)
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Configurar privacidade', exact: true })
    .click()
  await page
    .getByLabel('Nova senha de privacidade', { exact: true })
    .fill('Private123')
  await page
    .getByLabel('Confirmar senha de privacidade', { exact: true })
    .fill('Private123')
  await page
    .getByRole('button', { name: 'Salvar senha de privacidade', exact: true })
    .click()
  await expect(
    page.getByText('Senha de privacidade salva.', { exact: false }),
  ).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Configurar Alpha', exact: true })
    .click()
  await page.getByLabel('Seção privada', { exact: true }).check()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Private123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /Alpha$/, level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  const publicBook = await (
    await request.get(`${api}/notebooks/${book.id}`, { headers })
  ).json()
  expect(JSON.stringify(publicBook)).not.toContain('Texto pesquisável')
  const items = await (
    await request.get(`${api}/privacy/notebooks/${book.id}`, { headers })
  ).json()
  expect(
    (
      await request.get(`${api}/privacy/notebooks/${book.id}/${items[0].id}`, {
        headers,
      })
    ).status(),
  ).toBe(403)
  expect(
    await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('tomohu.account.v1.'))
        .map(([, value]) => value)
        .join(''),
    ),
  ).not.toContain('Texto pesquisável')
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Saved only in the private aggregate')
  await expect(
    page.getByText('Item privado salvo na conta', { exact: false }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Localização' })
    .getByRole('button', { name: 'Início', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Seção privada', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Saved only in the private aggregate',
  )
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Configurar privacidade', exact: true })
    .click()
  await page
    .getByRole('button', {
      name: 'Esqueci a senha de privacidade: enviar e-mail',
      exact: true,
    })
    .click()
  await expect(
    page.getByText('Link enviado ao e-mail verificado', { exact: false }),
  ).toBeVisible()
  await page.goto(await mail('private'))
  await page.getByLabel('Nova senha', { exact: true }).fill('NewPrivate123')
  await page
    .getByLabel('Confirmar nova senha', { exact: true })
    .fill('NewPrivate123')
  await page
    .getByRole('button', { name: 'Redefinir senha', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Senha de privacidade redefinida',
  )
  await page
    .getByRole('button', { name: 'Voltar ao caderno', exact: true })
    .click()
  // Recovery does not change the account password or revoke its login session.
  expect((await request.get(api + '/auth/me', { headers })).status()).toBe(200)
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page.getByRole('button', { name: 'Seção privada', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('NewPrivate123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Saved only in the private aggregate',
  )
  await page.getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Editar seção', exact: true }).click()
  await page.getByLabel('Seção privada', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await expect(
    page.getByText('Item privado salvo na conta', { exact: false }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: 'Editar seção', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Caderno da conta · última versão carregada', {
      exact: true,
    }),
  ).toBeVisible()
  const restored = await (
    await request.get(`${api}/notebooks/${book.id}`, { headers })
  ).json()
  expect(
    restored.snapshot.contents.find((c: { id: string }) => c.id === 'note')
      .text,
  ).toBe('Saved only in the private aggregate')
})
