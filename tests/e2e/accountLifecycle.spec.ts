import { test, expect, storageKey } from './notebook.fixture'

const origin = 'http://127.0.0.1:8000'

test('recovery request is explicit and failed requests remain retryable', async ({
  page,
}) => {
  let status = 0
  await page.route(
    `${origin}/api/v1/auth/password/reset-request`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        email: 'person@example.com',
      })
      if (!status) return route.abort('failed')
      return route.fulfill({ status, json: { message: 'Requested' } })
    },
  )
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail para recuperação').fill('person@example.com')
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByRole('alert')).toContainText('Confira a conexão')
  await expect(
    page.getByText('Solicitação recebida.', { exact: false }),
  ).toHaveCount(0)
  status = 202
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByRole('status')).toContainText('Solicitação recebida')
  await page.getByRole('button', { name: 'Voltar ao login' }).click()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
})

for (const purpose of ['verify', 'reset'])
  test(`${purpose} links leave storage intact, clear the URL and require confirmation`, async ({
    page,
  }) => {
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    )
    let requests = 0
    await page.route(
      `${origin}/api/v1/auth/${purpose === 'verify' ? 'email/verify' : 'password/reset'}`,
      async (route) => {
        requests++
        expect(route.request().method()).toBe('POST')
        expect(route.request().postDataJSON().token).toBe('opaque.secret')
        await route.fulfill({ json: { message: 'Done' } })
      },
    )
    await page.goto(`/#account/${purpose}/opaque.secret`)
    await expect(page).not.toHaveURL(/opaque.secret/)
    expect(requests).toBe(0)
    if (purpose === 'reset') {
      await page.getByLabel('Nova senha', { exact: true }).fill('Ab123')
      await page.getByLabel('Confirmar nova senha').fill('Different1')
      await page.getByRole('button', { name: 'Redefinir senha' }).click()
      await expect(page.getByRole('alert')).toHaveText(
        'As senhas não coincidem.',
      )
      expect(requests).toBe(0)
      await page.getByLabel('Confirmar nova senha').fill('Ab123')
    }
    await page
      .getByRole('button', {
        name: purpose === 'verify' ? 'Confirmar meu e-mail' : 'Redefinir senha',
      })
      .click()
    await expect(page.getByRole('status')).toContainText('preservados')
    expect(requests).toBe(1)
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBe(before)
    await page.getByRole('button', { name: 'Voltar ao caderno' }).click()
    await expect(
      page.getByRole('button', { name: 'Ajustes', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ),
    ).not.toContain('opaque.secret')
  })

test('expired email links show an actionable error without replacing data', async ({
  page,
}) => {
  await page.route(`${origin}/api/v1/auth/email/verify`, (route) =>
    route.fulfill({ status: 400, json: { detail: 'Expired' } }),
  )
  await page.goto('/#account/verify/expired')
  await page.getByRole('button', { name: 'Confirmar meu e-mail' }).click()
  await expect(page.getByRole('alert')).toContainText('Solicite um novo link')
})

test('security controls validate password changes and revoke only the selected session', async ({
  page,
}) => {
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  )
  let sessions = [
    {
      id: 'current',
      current: true,
      created_at: '2026-11-11T12:00:00Z',
      expires_at: '2026-11-11T12:15:00Z',
    },
    {
      id: 'other',
      current: false,
      created_at: '2026-11-11T12:01:00Z',
      expires_at: '2026-11-11T12:16:00Z',
    },
  ]
  let changed = 0
  await page.route(`${origin}/api/v1/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    const reply = (value: unknown) => route.fulfill({ json: value })
    if (path.endsWith('/login'))
      return reply({
        access_token: 'token',
        token_type: 'bearer',
        expires_in: 900,
      })
    if (path.endsWith('/me'))
      return reply({
        id: 'alice',
        email: 'alice@example.com',
        email_verified: false,
      })
    if (path.endsWith('/notebooks')) return reply([])
    if (path.endsWith('/sessions')) return reply(sessions)
    if (path.endsWith('/sessions/other')) {
      expect(route.request().method()).toBe('DELETE')
      sessions = sessions.slice(0, 1)
      return reply({ message: 'Done' })
    }
    if (path.endsWith('/password/change')) {
      expect(route.request().postDataJSON()).toEqual({
        current_password: 'Legacy password',
        password: 'Ab123',
      })
      changed++
      return reply({ message: 'Changed' })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Legacy password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Segurança da conta', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Atualizar sessões', exact: true })
    .click()
  await expect(page.getByText('Outra sessão ·', { exact: false })).toBeVisible()
  await page
    .getByRole('button', { name: 'Encerrar sessão', exact: true })
    .click()
  await expect(page.getByText('Outra sessão ·', { exact: false })).toHaveCount(
    0,
  )
  for (const theme of ['Claro', 'Escuro']) {
    await page.getByRole('button', { name: theme, exact: true }).click()
    const fits = await page
      .getByRole('dialog', { name: 'Ajustes' })
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1)
    expect(fits).toBe(true)
  }
  await page.getByLabel('Senha atual', { exact: true }).fill('Legacy password')
  await page.getByLabel('Nova senha', { exact: true }).fill('abc12')
  await page.getByLabel('Confirmar nova senha').fill('abc12')
  await page
    .getByRole('button', { name: 'Alterar senha e encerrar sessões' })
    .click()
  await expect(page.getByRole('alert')).toContainText('maiúscula')
  expect(changed).toBe(0)
  await page.getByLabel('Nova senha', { exact: true }).fill('Ab123')
  await page.getByLabel('Confirmar nova senha').fill('Ab123')
  await page
    .getByRole('button', { name: 'Alterar senha e encerrar sessões' })
    .click()
  await expect(
    page.getByText('Senha alterada.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  expect(changed).toBe(1)
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(before)
})

test('reset dialog preserves input on blank-space clicks and announces confirmed success', async ({
  page,
}) => {
  let release: () => void = () => {
    throw new Error('Request not started')
  }
  await page.route(`${origin}/api/v1/auth/password/reset`, async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill({ json: { message: 'Password reset.' } })
  })
  await page.goto('/#account/reset/opaque.secret')
  const dialog = page.getByRole('dialog', { name: 'Criar nova senha' })
  await page.getByLabel('Nova senha', { exact: true }).fill('Ab123')
  await page.getByLabel('Confirmar nova senha').fill('Ab123')
  const bounds = await dialog.boundingBox()
  if (!bounds) throw new Error('Missing reset dialog')
  await page.mouse.click(bounds.x + 2, bounds.y + 30)
  await expect(dialog).toBeVisible()
  await page.mouse.click(1, 1)
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Confirmar nova senha')).toHaveValue('Ab123')
  const confirmation = await page
    .getByLabel('Confirmar nova senha')
    .boundingBox()
  const button = await page
    .getByRole('button', { name: 'Redefinir senha' })
    .boundingBox()
  if (!confirmation || !button) throw new Error('Missing form controls')
  expect(
    button.y - confirmation.y - confirmation.height,
  ).toBeGreaterThanOrEqual(12)
  await page.getByRole('button', { name: 'Redefinir senha' }).click()
  await expect(page.getByRole('button', { name: 'Aguarde…' })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
  await expect(
    page.getByRole('heading', { name: 'Senha redefinida', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Senha redefinida e sessões encerradas',
  )
  await expect(
    page.getByText('Abrir este link não altera sua conta.', { exact: false }),
  ).toHaveCount(0)
  await expect(page.getByLabel('Nova senha', { exact: true })).toHaveCount(0)
  await page.mouse.click(1, 1)
  await expect(
    page.getByRole('dialog', { name: 'Senha redefinida' }),
  ).toBeVisible()
})

test('ordinary dialogs distinguish internal padding from the outside backdrop', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajustes' })
  const bounds = await dialog.boundingBox()
  if (!bounds) throw new Error('Missing settings dialog')
  await page.mouse.click(bounds.x + 2, bounds.y + 30)
  await expect(dialog).toBeVisible()
  await page.mouse.click(1, 1)
  await expect(dialog).toHaveCount(0)
})
