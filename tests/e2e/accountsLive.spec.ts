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
