import { test, expect, fixture } from './notebook.fixture'
import type { Notebook } from '../../src/types'

const origin = 'http://127.0.0.1:8000/api/v1'

test('privacy password, hidden previews, private editing, display preference and recovery stay isolated', async ({
  page,
}, testInfo) => {
  let snapshot = structuredClone(fixture)
  let privateSnapshot: Notebook | null = null
  let revision = 1
  let privateRevision = 1
  let protectedItem = false
  let configured = false
  let resets = 0
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const method = request.method()
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json })
    if (path === '/auth/login')
      return reply({
        access_token: 'account-token',
        expires_in: 900,
        token_type: 'bearer',
      })
    if (path === '/auth/me')
      return reply({
        id: 'owner',
        email: 'owner@example.com',
        email_verified: true,
      })
    if (path === '/notebooks') return reply([{ id: 'book', revision }])
    if (path === '/notebooks/book')
      return reply({ id: 'book', revision, snapshot })
    if (path === '/privacy/status') return reply({ configured })
    if (path === '/privacy/password') {
      configured = true
      return reply({})
    }
    if (path === '/privacy/unlock')
      return request.postDataJSON().password === 'Private123'
        ? reply({ token: 'grant', expires_in: 300 })
        : reply({}, 403)
    if (path === '/privacy/reset-request') {
      resets++
      return reply({})
    }
    if (path === '/privacy/notebooks/book' && method === 'GET')
      return reply(
        protectedItem
          ? [
              {
                id: 'private-one',
                kind: 'section',
                root_id: 'alpha',
                parent_id: null,
                position: 0,
                ...(request.headers()['x-privacy-token']
                  ? { title: 'Alpha' }
                  : {}),
              },
            ]
          : [],
      )
    if (path === '/privacy/notebooks/book' && method === 'POST') {
      const ids = new Set(['alpha', 'child'])
      privateSnapshot = {
        schemaVersion: 1,
        sections: snapshot.sections.filter((s) => ids.has(s.id)),
        contents: snapshot.contents.filter((c) => ids.has(c.sectionId)),
        reminders: [],
      }
      snapshot = {
        ...snapshot,
        sections: snapshot.sections.filter((s) => !ids.has(s.id)),
        contents: snapshot.contents.filter((c) => !ids.has(c.sectionId)),
      }
      protectedItem = true
      revision++
      return reply({
        id: 'private-one',
        notebook: { id: 'book', revision, snapshot },
      })
    }
    if (path === '/privacy/notebooks/book/private-one') {
      expect(request.headers()['x-privacy-token']).toBe('grant')
      if (method === 'PUT') {
        privateSnapshot = request.postDataJSON().snapshot
        privateRevision++
        return reply({ snapshot: privateSnapshot, revision: privateRevision })
      }
      return reply({ snapshot: privateSnapshot, revision: privateRevision })
    }
    return reply({}, 404)
  })
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Account123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
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
  await page.getByLabel('Caderno da conta').selectOption('book')
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await expect(
    page.getByText('Caderno da conta · última versão carregada', {
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Configurar Alpha', exact: true })
    .click()
  await page.getByLabel('Seção privada', { exact: true }).check()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Wrong123')
  await page
    .getByRole('dialog', { name: 'Senha de privacidade', exact: true })
    .screenshot({ path: testInfo.outputPath('compact-unlock.png') })
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(page.getByRole('alert').last()).toContainText(
    'Senha de privacidade incorreta',
  )
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
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('New private text')
  await expect
    .poll(() => privateSnapshot?.contents.find((c) => c.kind === 'note')?.text)
    .toBe('New private text')
  await page
    .getByRole('navigation', { name: 'Localização' })
    .getByRole('button', { name: 'Início', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Seção privada', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('locked-inline.png'),
    animations: 'disabled',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light'
  })
  await page.screenshot({
    path: testInfo.outputPath('locked-inline-light.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
  })
  expect(
    await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([k]) => k.startsWith('tomohu.account.v1.'))
        .map(([, v]) => v)
        .join(''),
    ),
  ).not.toContain('New private text')
  await page.getByRole('button', { name: 'Seção privada', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Senha de privacidade', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Configurar privacidade', exact: true })
    .click()
  await page.getByLabel('Exibição dos itens privados').selectOption('area')
  await page
    .getByRole('button', { name: 'Abrir itens privados', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Private123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Itens privados', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Itens privados', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
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
  expect(resets).toBe(1)
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Seção privada', exact: true }),
  ).toHaveCount(0)
})

test('privacy recovery confirms a distinct action without changing account login', async ({
  page,
}) => {
  let confirmation = 0
  await page.route(`${origin}/privacy/reset`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: 'safe-link',
      password: 'Private456',
    })
    confirmation++
    await route.fulfill({ json: {} })
  })
  await page.goto('/#account/private/safe-link')
  await expect(
    page.getByRole('dialog', {
      name: 'Nova senha de privacidade',
      exact: true,
    }),
  ).toBeVisible()
  expect(confirmation).toBe(0)
  await page.getByLabel('Nova senha', { exact: true }).fill('Private456')
  await page
    .getByLabel('Confirmar nova senha', { exact: true })
    .fill('Private456')
  await page
    .getByRole('button', { name: 'Redefinir senha', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Senha de privacidade redefinida',
  )
  expect(confirmation).toBe(1)
})

test('a newly created private content never passes through the public notebook', async ({
  page,
}) => {
  let created: Notebook | null = null
  let root = ''
  let saved = 0
  let rejectSave = false
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const reply = (json: unknown) => route.fulfill({ json })
    if (path === '/auth/login')
      return reply({
        access_token: 'account-token',
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
      expect(request.method()).toBe('GET')
      return reply({ id: 'book', revision: created ? 2 : 1, snapshot: fixture })
    }
    if (path === '/privacy/notebooks/book')
      return reply(
        created
          ? [
              {
                id: 'private-new',
                kind: 'content',
                root_id: root,
                parent_id: 'alpha',
                position: 4,
              },
            ]
          : [],
      )
    if (path === '/privacy/unlock')
      return reply({ token: 'grant', expires_in: 300 })
    if (path === '/privacy/notebooks/book/create') {
      const payload = request.postDataJSON()
      expect(payload.kind).toBe('content')
      expect(payload.parent_id).toBe('alpha')
      created = payload.snapshot
      root = payload.root_id
      return reply({
        id: 'private-new',
        notebook: { id: 'book', revision: 2, snapshot: fixture },
      })
    }
    if (path === '/privacy/notebooks/book/private-new') {
      if (request.method() === 'PUT') {
        if (rejectSave)
          return route.fulfill({ status: 409, json: { detail: 'Conflict' } })
        saved++
        created = request.postDataJSON().snapshot
      }
      return reply({ snapshot: created, revision: saved + 1 })
    }
    return route.fulfill({ status: 404, json: {} })
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
  await page.goto('/#section/alpha')
  await page.getByRole('button', { name: 'Conteúdo', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Born private')
  await page.getByLabel('Conteúdo privado', { exact: true }).check()
  await page.getByRole('button', { name: 'Criar e abrir', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Senha de privacidade', exact: true })
    .fill('Private123')
  await page.getByRole('button', { name: 'Acessar', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Senha de privacidade', exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('Sua nota').fill('Private from birth')
  await expect.poll(() => saved).toBe(1)
  rejectSave = true
  await page.getByLabel('Sua nota').fill('Unsaved private conflict')
  await expect(
    page.getByRole('button', { name: 'Exportar rascunho', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Recarregar item da conta', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('navigation', { name: 'Localização' })
    .getByRole('button', { name: 'Alpha', exact: true })
    .click()
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Unsaved private conflict',
  )
  const downloaded = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar rascunho', exact: true })
    .click()
  await downloaded
  await page
    .getByRole('button', { name: 'Recarregar item da conta', exact: true })
    .click()
  await expect(page.getByLabel('Sua nota')).toHaveValue('Private from birth')

  await page
    .getByRole('navigation', { name: 'Localização' })
    .getByRole('button', { name: 'Alpha', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Conteúdo privado', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([k]) => k.startsWith('tomohu.account.v1.'))
        .map(([, v]) => v)
        .join(''),
    ),
  ).not.toContain('Born private')
})
