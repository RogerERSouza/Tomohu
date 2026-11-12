import { randomUUID } from 'node:crypto'
import { test, expect, fixture, storageKey } from './notebook.fixture'

test('real API registration, guest copy and revision-checked sync persist across reauthentication', async ({
  page,
}) => {
  test.skip(
    process.env.TOMOHU_LIVE_API !== '1',
    'Requires the isolated live API configured by the integration job.',
  )
  const guest = structuredClone(fixture)
  const counter = guest.contents.find((content) => content.kind === 'counter')
  if (!counter || counter.kind !== 'counter')
    throw new Error('Missing counter fixture')
  counter.entries.push({
    id: 'legacy-entry',
    delta: 1,
    note: '',
    createdAt: 'Wed, 01 Jan 2025 00:00:00 GMT',
  })
  await page.evaluate(
    ({ key, snapshot }) => localStorage.setItem(key, JSON.stringify(snapshot)),
    { key: storageKey, snapshot: guest },
  )
  await page.reload()
  const email = `integration-${randomUUID()}@example.com`
  const password = 'Live account test password 123!'
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Quero criar uma conta' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByLabel(/Confirmo enviar uma cópia/).check()
  await page
    .getByRole('button', { name: 'Enviar cópia como novo caderno' })
    .click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Persisted in the real API')
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(
    page.getByText('Cópia local igual à última versão carregada ou enviada.'),
  ).toBeVisible()
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      storageKey,
    ),
  ).toEqual(guest)
  // Remove only the acknowledged account cache to prove the next load comes from the API.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('tomohu.account.v1.')) localStorage.removeItem(key)
  })
  await page.reload()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByLabel('Caderno da conta').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Abrir caderno da conta' }).click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Persisted in the real API',
  )
})

test('real email verification, password reset and session revocation preserve a notebook', async ({
  page,
}) => {
  test.skip(
    process.env.TOMOHU_LIVE_API !== '1',
    'Requires the isolated API and local mail worker.',
  )
  test.setTimeout(60000)
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const directory = process.env.TOMOHU_MAIL_OUTBOX ?? ''
  if (!directory) throw new Error('Missing isolated mail directory')
  const email = `lifecycle-${randomUUID()}@example.com`
  const oldPassword = 'LivePassword123'
  async function mailLink(purpose: string): Promise<string> {
    let link = ''
    await expect
      .poll(
        async () => {
          let files: string[]
          try {
            files = await readdir(directory)
          } catch {
            return false
          }
          for (const file of files) {
            const mail = (
              await readFile(join(directory, file), 'utf8')
            ).replace(/=\r?\n/g, '')
            if (!mail.includes(`To: ${email}`)) continue
            const found = mail.match(
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
        { timeout: 15000 },
      )
      .toBe(true)
    return link
  }
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Quero criar uma conta' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(oldPassword)
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Criar caderno vazio' }).click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
  const caches = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([key]) =>
        key.startsWith('tomohu.account.v1.'),
      ),
    ),
  )
  const verification = await mailLink('verify')
  const tab = await page.context().newPage()
  await tab.goto(verification)
  await tab.getByRole('button', { name: 'Confirmar meu e-mail' }).click()
  await expect(tab.getByRole('status')).toContainText('E-mail confirmado')
  await tab.close()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Atualizar confirmação', exact: true })
    .click()
  await expect(
    page.getByText('E-mail verificado.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await expect(
    page.getByText('E-mail verificado.', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Atualizar sessões', exact: true })
    .click()
  await expect(page.getByText('Esta sessão ·', { exact: false })).toBeVisible()
  await page
    .getByRole('button', { name: 'Sair e voltar ao caderno local' })
    .click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail para recuperação').fill(email)
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(
    page.getByText('Solicitação recebida.', { exact: false }),
  ).toBeVisible()
  await page.goto(await mailLink('reset'))
  await page.getByLabel('Nova senha', { exact: true }).fill('Ab123')
  await page.getByLabel('Confirmar nova senha').fill('Ab123')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()
  await expect(page.getByRole('status')).toContainText('Senha redefinida')
  await page.getByRole('button', { name: 'Voltar ao caderno' }).click()
  await page.getByRole('button', { name: 'Voltar ao login' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('Ab123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page.getByLabel('Caderno da conta').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Abrir caderno da conta' }).click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) =>
          key.startsWith('tomohu.account.v1.'),
        ),
      ),
    ),
  ).toEqual(caches)
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await page.getByLabel('Senha atual', { exact: true }).fill('Ab123')
  await page.getByLabel('Nova senha', { exact: true }).fill('Next123')
  await page.getByLabel('Confirmar nova senha').fill('Next123')
  await page
    .getByRole('button', { name: 'Alterar senha e encerrar sessões' })
    .click()
  await expect(
    page.getByText('Senha alterada.', { exact: false }),
  ).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('Next123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Encerrar todas as sessões', exact: true })
    .click()
  await expect(
    page.getByText('Todas as sessões foram encerradas.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toContainText('sessão encerrada')
})
