import { readFile } from 'node:fs/promises'
import { test, expect, fixture, storageKey } from './notebook.fixture'
import type { Page } from '@playwright/test'
import type { RemoteNotebook } from '../../src/lib/api/client'

const origin = 'http://127.0.0.1:8000'
const password = 'Account test password 123!'
async function settings(page: Page) {
  if (await page.getByRole('button', { name: 'Ajustes', exact: true }).count())
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
}
async function login(page: Page, email = 'alice@example.com') {
  await expect(
    page.getByText('Verificando sua sessão…', { exact: true }),
  ).toHaveCount(0)
  if (!(await page.getByLabel('E-mail', { exact: true }).count())) {
    if (
      !(await page
        .getByRole('dialog', { name: 'Ajustes', exact: true })
        .count())
    )
      await settings(page)
    await expect(
      page.getByText('Conectado como', { exact: false }),
    ).toBeVisible()
    return
  }
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  if (
    !(await page.getByRole('dialog', { name: 'Ajustes', exact: true }).count())
  )
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
}
async function mockApi(page: Page) {
  const books: Record<string, RemoteNotebook> = {
    book: { id: 'book', revision: 1, snapshot: structuredClone(fixture) },
  }
  let active = 'alice'
  const controls = {
    failSave: 0,
    created: 0,
    books,
    loginStatus: 200,
    registerStatus: 201,
    renewStatus: 200,
  }
  await page.route(`${origin}/api/v1/**`, async (route) => {
    const request = route.request()
    let path = new URL(request.url()).pathname
    const method = path.endsWith('/browser/bootstrap')
      ? 'GET'
      : request.method()
    if (path.endsWith('/browser/bootstrap') && active !== 'bob')
      path = '/api/v1/notebooks/book'
    const reply = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        json: value,
        headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    if (path.startsWith('/api/v1/privacy/notebooks/')) return reply([])
    if (path.endsWith('/browser/bootstrap'))
      return reply({
        id: 'bob-book',
        revision: 1,
        snapshot: {
          schemaVersion: 1,
          sections: [],
          contents: [],
          reminders: [],
        },
      })
    if (path.endsWith('/browser/refresh'))
      return reply(
        {
          access_token: `token-${active}`,
          token_type: 'bearer',
          expires_in: 900,
        },
        controls.renewStatus,
      )
    if (
      path === '/api/v1/auth/browser/logout' ||
      path === '/api/v1/auth/logout'
    )
      return reply({ message: 'Session ended.' })
    if (path === '/api/v1/auth/register')
      return reply(
        { id: 'alice', email: 'alice@example.com' },
        controls.registerStatus,
      )
    if (path === '/api/v1/auth/browser/login') {
      if (controls.loginStatus !== 200) return reply({}, controls.loginStatus)
      const body = request.postDataJSON()
      active = body.email.startsWith('bob') ? 'bob' : 'alice'
      return reply({
        access_token: `token-${active}`,
        token_type: 'bearer',
        expires_in: 900,
      })
    }
    if (path === '/api/v1/auth/me')
      return reply({ id: active, email: `${active}@example.com` })
    if (path === '/api/v1/notebooks' && method === 'GET')
      return reply(
        active === 'bob'
          ? []
          : Object.values(books).map(({ id, revision }) => ({ id, revision })),
      )
    if (path === '/api/v1/notebooks' && method === 'POST') {
      const id = `copy-${++controls.created}`
      const snapshot = request.postDataJSON().snapshot
      books[id] = { id, revision: 1, snapshot }
      return reply(books[id], 201)
    }
    const id = path.split('/').at(-1) ?? ''
    const book = books[id]
    if (!book || active === 'bob') return reply({ detail: 'Not found' }, 404)
    if (method === 'GET') return reply(book)
    if (method === 'PUT') {
      if (controls.failSave === 0) {
        const body = request.postDataJSON()
        if (body.revision !== book.revision) return reply({}, 409)
        books[id] = { id, revision: book.revision + 1, snapshot: body.snapshot }
        return reply(books[id])
      }
      if (controls.failSave === -1) return route.abort('failed')
      return reply({}, controls.failSave)
    }
    return reply({}, 404)
  })
  return controls
}
async function openBook(page: Page) {
  await page
    .getByLabel('Caderno da conta', { exact: true })
    .selectOption('book')
  await page
    .getByRole('button', { name: 'Abrir caderno da conta', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Ajustes', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
}

test('guest migration is explicit; sync, logout and account switching preserve isolated copies', async ({
  page,
}) => {
  const api = await mockApi(page)
  await settings(page)
  await login(page)
  await expect(
    page.getByRole('button', { name: 'Enviar cópia como novo caderno' }),
  ).toBeDisabled()
  await page.getByLabel(/Confirmo enviar uma cópia/).check()
  await page
    .getByRole('button', { name: 'Enviar cópia como novo caderno' })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Ajustes', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toBeVisible()
  expect(api.books['copy-1'].snapshot).toEqual(fixture)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Account edit')
  await settings(page)
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(
    page.getByText('Cópia local igual à última versão carregada ou enviada.'),
  ).toBeVisible()
  expect(api.books['copy-1'].snapshot.contents[0]).toMatchObject({
    text: 'Account edit',
  })
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      storageKey,
    ),
  ).toEqual(fixture)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(
    page.getByText('Caderno da conta ·', { exact: false }),
  ).toHaveCount(0)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveCount(0)
  await settings(page)
  await login(page, 'bob@example.com')
  await expect(page.getByLabel('Caderno da conta')).toHaveValue('')
  expect(
    await page.getByLabel('Caderno da conta').locator('option').count(),
  ).toBe(2)
  const persistent = await page.evaluate(() =>
    JSON.stringify({ ...localStorage }),
  )
  expect(persistent).not.toContain('token-alice')
  expect(persistent).not.toContain(password)
})

test('network retry and revision conflicts keep edits until an explicit remote replacement', async ({
  page,
}) => {
  const api = await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Pending local edit')
  await settings(page)
  api.failSave = -1
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(page.getByRole('alert')).toContainText('conexão')
  api.failSave = 409
  api.books.book = {
    ...api.books.book,
    revision: 2,
    snapshot: {
      ...fixture,
      contents: fixture.contents.map((c) =>
        c.kind === 'note' ? { ...c, text: 'Remote edit' } : c,
      ),
    },
  }
  await page
    .getByRole('button', { name: 'Tentar reconectar', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Sincronizar agora', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(page.getByRole('alert')).toContainText('versão da conta mudou')
  await expect(
    page.getByRole('button', { name: 'Sincronizar agora' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Carregar versão da conta' }),
  ).toBeDisabled()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cópia aberta' }).click()
  await download
  await page.getByLabel(/Já exportei o que preciso/).check()
  await page.getByRole('button', { name: 'Carregar versão da conta' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue('Remote edit')
})

test('rejected renewal and reload require login without moving account data into the guest notebook', async ({
  page,
}) => {
  const api = await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Not uploaded')
  api.renewStatus = 401
  await page.clock.fastForward(901000)
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
  await expect(page.getByText(/Sua sessão foi encerrada/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sincronizar agora' }),
  ).toHaveCount(0)
  await page.reload()
  await settings(page)
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue('Not uploaded')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      storageKey,
    ),
  ).toEqual(fixture)
})

test('authentication errors stay contextual and never replace the guest notebook', async ({
  page,
}) => {
  const api = await mockApi(page)
  await settings(page)
  api.loginStatus = 401
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.com')
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'E-mail ou senha inválidos',
  )
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Quero criar uma conta' }).click()
  api.registerStatus = 409
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível criar a conta',
  )
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      storageKey,
    ),
  ).toEqual(fixture)
})

test('a corrupt account cache is preserved until export and confirmed recovery', async ({
  page,
}) => {
  await mockApi(page)
  const key = 'tomohu.account.v1.alice.book'
  await page.evaluate(
    (key) => localStorage.setItem(key, '{damaged-account-cache'),
    key,
  )
  await settings(page)
  await login(page)
  await openBook(page)
  await expect(page.getByRole('alert')).toContainText(
    'cache desta conta está inválido',
  )
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    '{damaged-account-cache',
  )
  await settings(page)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cache preservado' }).click()
  await downloaded
  await page.getByLabel(/Já exportei o que preciso/).check()
  await page.getByRole('button', { name: 'Carregar versão da conta' }).click()
  await expect(
    page.getByText('O cache desta conta está inválido.', { exact: false }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null').snapshot,
      key,
    ),
  ).toEqual(fixture)
})

test('unavailable browser storage blocks switching until export and can recover on retry', async ({
  page,
}) => {
  await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (
        key.startsWith('tomohu.account.v1.') &&
        sessionStorage.getItem('quota-simulated') === 'true'
      )
        throw new DOMException('Storage full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
    sessionStorage.setItem('quota-simulated', 'true')
  })
  await page.goto('/#content/note')
  await page.getByLabel('Sua nota').fill('Preserve despite quota')
  await settings(page)
  await expect(
    page.getByRole('button', { name: 'Sair da conta' }),
  ).toBeDisabled()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar cópia aberta' }).click()
  await downloaded
  await expect(
    page.getByRole('button', { name: 'Sair da conta' }),
  ).toBeEnabled()
  await page.evaluate(() => sessionStorage.setItem('quota-simulated', 'false'))
  await page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await expect(
    page.getByText('Cópia local igual à última versão carregada ou enviada.'),
  ).toBeVisible()
})

test('account and sync controls fit narrow dialogs in both themes', async ({
  page,
}, info) => {
  await mockApi(page)
  await settings(page)
  for (const connected of [false, true]) {
    if (connected) {
      await login(page)
      await openBook(page)
      await settings(page)
    }
    for (const theme of ['Escuro', 'Claro']) {
      if (connected)
        await page.getByRole('button', { name: theme, exact: true }).click()
      for (const width of [320, 360, 760, 1280]) {
        await page.setViewportSize({ width, height: 780 })
        const dialog = connected
          ? page.getByRole('dialog')
          : page.locator('.auth-shell')
        await page
          .getByRole('heading', {
            name: connected ? 'Sincronização' : 'Conta e cadernos',
            exact: true,
          })
          .scrollIntoViewIfNeeded()
        const bounds = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const controls = [
            ...element.querySelectorAll(
              '.account-panel input,.account-panel select,.account-panel button',
            ),
          ]
          return {
            overflow: element.scrollWidth - element.clientWidth,
            page: document.documentElement.scrollWidth - innerWidth,
            outside: controls.filter((control) => {
              const box = control.getBoundingClientRect()
              return box.left < rect.left - 1 || box.right > rect.right + 1
            }).length,
          }
        })
        expect(bounds).toEqual({ overflow: 0, page: 0, outside: 0 })
        await page.screenshot({
          path: info.outputPath(
            `${connected ? 'sync' : 'login'}-${theme}-${width}.png`,
          ),
          animations: 'disabled',
        })
      }
    }
  }
})

test('legacy storage write failures do not prevent login or overwrite the source', async ({
  page,
}) => {
  await mockApi(page)
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, name, value)
    }
  }, storageKey)
  await login(page)
  await expect(page.getByText('Conectado como', { exact: false })).toBeVisible()
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    ),
  ).toEqual(fixture)
})

test('pending remote loads block imports until completion and later imports persist', async ({
  page,
}) => {
  await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  await settings(page)
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route(`${origin}/api/v1/notebooks/book`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    requested()
    await gate
    await route.fulfill({
      json: { id: 'book', revision: 1, snapshot: fixture },
    })
  })
  await page
    .getByRole('button', { name: 'Carregar versão da conta', exact: true })
    .click()
  await started
  await expect(
    page.getByRole('button', { name: 'Importar cópia dos dados', exact: true }),
  ).toBeDisabled()
  const imported = structuredClone(fixture)
  for (const item of imported.contents)
    if (item.kind === 'note') item.text = 'Imported after remote recovery'
  // A file chooser/read may already be in flight when the remote operation starts.
  await page.locator('input[type=file]').setInputFiles({
    name: 'pending.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  const replace = page.getByRole('button', {
    name: 'Substituir dados',
    exact: true,
  })
  await expect(replace).toBeDisabled()
  await expect(
    page.getByText('Aguarde a operação da conta terminar antes de importar.'),
  ).toBeVisible()
  release()
  await expect(replace).toBeEnabled()
  await replace.click()
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Imported after remote recovery',
  )
  await page.reload()
  await settings(page)
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Imported after remote recovery',
  )
})

test('remote recovery preserves a different tab draft even after that tab closes', async ({
  page,
  context,
}) => {
  await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  const other = await context.newPage()
  await mockApi(other)
  await other.goto('/')
  await settings(other)
  await login(other)
  await openBook(other)
  await settings(page)
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route(`${origin}/api/v1/notebooks/book`, async (route) => {
    requested()
    await gate
    await route.fulfill({
      json: { id: 'book', revision: 1, snapshot: fixture },
    })
  })
  await page
    .getByRole('button', { name: 'Carregar versão da conta', exact: true })
    .click()
  await started
  await other.goto('/#content/note')
  await other.getByLabel('Sua nota').fill('Other tab durable draft')
  await expect(
    page.getByRole('button', {
      name: 'Exportar cache preservado',
      exact: true,
    }),
  ).toBeVisible()
  await other.close()
  release()
  await expect(
    page.getByRole('button', { name: 'Carregar versão da conta', exact: true }),
  ).toBeDisabled()
  const key = 'tomohu.account.v1.alice.book'
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
    .toContain('Other tab durable draft')
  const downloading = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar cache preservado', exact: true })
    .click()
  const stream = await (await downloading).createReadStream()
  if (!stream) throw new Error('Recovery stream unavailable')
  let text = ''
  for await (const chunk of stream) text += chunk.toString()
  expect(text).toContain('Other tab durable draft')
  await page.getByLabel(/Já exportei o que preciso/).check()
  await page
    .getByRole('button', { name: 'Carregar versão da conta', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Exportar cache preservado',
      exact: true,
    }),
  ).toHaveCount(0)
})

test('a preserved cache export can be restored with the normal backup importer', async ({
  page,
}) => {
  await mockApi(page)
  await settings(page)
  await login(page)
  await openBook(page)
  const key = 'tomohu.account.v1.alice.book'
  const other = structuredClone(fixture)
  for (const c of other.contents)
    if (c.kind === 'note') c.text = 'Recoverable other-tab draft'
  await page.evaluate(
    ({ key, snapshot }) => {
      const cache = JSON.parse(localStorage.getItem(key) ?? 'null')
      cache.snapshot = snapshot
      localStorage.setItem(key, JSON.stringify(cache))
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue: JSON.stringify(cache) }),
      )
    },
    { key, snapshot: other },
  )
  await settings(page)
  const downloading = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar cache preservado', exact: true })
    .click()
  const stream = await (await downloading).createReadStream()
  if (!stream) throw new Error('Export unavailable')
  let raw = ''
  for await (const chunk of stream) raw += chunk.toString()
  expect(raw).toContain('Recoverable other-tab draft')
  await page.getByLabel(/Já exportei o que preciso/).check()
  await page
    .getByRole('button', { name: 'Carregar versão da conta', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Exportar cache preservado',
      exact: true,
    }),
  ).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles({
    name: 'tomohu-preserved-account-cache.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  })
  await page
    .getByRole('button', { name: 'Substituir dados', exact: true })
    .click()
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Recoverable other-tab draft',
  )
})

test('unsaved public edits survive expiry, require the same account and recover after storage returns', async ({
  page,
}) => {
  const api = await mockApi(page)
  await login(page)
  await openBook(page)
  await page.goto('/#content/note')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    window.addEventListener(
      'restore-account-storage',
      () => {
        Storage.prototype.setItem = original
      },
      { once: true },
    )
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('tomohu.account.v1.'))
        throw new DOMException('Storage full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByLabel('Sua nota').fill('Unsaved draft must survive expiry')
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar')
  api.renewStatus = 401
  await page.clock.fastForward(15 * 60 * 1000)
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Sua nota')).toHaveCount(0)
  expect(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(true)
  await page.getByLabel('E-mail', { exact: true }).fill('bob@example.com')
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(
    page.getByText(
      'Entre na mesma conta para recuperar o rascunho pendente antes de trocar de conta.',
      { exact: true },
    ),
  ).toBeVisible()
  await login(page)
  await expect(page.getByLabel('Caderno da conta')).toBeDisabled()
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click()
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Unsaved draft must survive expiry',
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event('restore-account-storage')),
  )
  await settings(page)
  await page
    .getByRole('button', { name: 'Sincronizar agora', exact: true })
    .click()
  await expect(
    page.getByText('Cópia local igual à última versão carregada ou enviada.'),
  ).toBeVisible()
  expect(
    api.books.book.snapshot.contents.find((content) => content.kind === 'note'),
  ).toMatchObject({ text: 'Unsaved draft must survive expiry' })
})

test('legacy read failures preserve the last copy for export and allow explicit retry', async ({
  page,
}) => {
  const api = await mockApi(page)
  await login(page)
  await page.evaluate(() => {
    const get = Storage.prototype.getItem
    window.addEventListener(
      'restore-legacy-read',
      () => {
        Storage.prototype.getItem = get
      },
      { once: true },
    )
    Storage.prototype.getItem = function (key) {
      if (key === 'task.notebook.v1')
        throw new DOMException('Storage unavailable', 'SecurityError')
      return get.call(this, key)
    }
  })
  await page.getByLabel(/Confirmo copiar os dados anteriores/).check()
  await page
    .getByRole('button', {
      name: 'Copiar dados anteriores para a conta',
      exact: true,
    })
    .click()
  const legacy = page.getByRole('region', {
    name: 'Dados anteriores',
    exact: true,
  })
  await expect(legacy.getByRole('alert').first()).toContainText(
    'Não foi possível ler',
  )
  expect(api.created).toBe(0)
  const downloaded = page.waitForEvent('download')
  await legacy
    .getByRole('button', { name: 'Exportar dados anteriores', exact: true })
    .click()
  const file = await (await downloaded).path()
  if (!file) throw new Error('Missing preserved legacy download')
  expect(await readFile(file, 'utf8')).toBe(JSON.stringify(fixture))
  await page.evaluate(() =>
    window.dispatchEvent(new Event('restore-legacy-read')),
  )
  await legacy
    .getByRole('button', {
      name: 'Tentar ler dados anteriores novamente',
      exact: true,
    })
    .click()
  await expect(legacy.getByRole('alert')).toHaveCount(0)
  await expect(legacy.getByRole('checkbox')).not.toBeChecked()
  await legacy.getByRole('checkbox').check()
  await legacy
    .getByRole('button', {
      name: 'Copiar dados anteriores para a conta',
      exact: true,
    })
    .click()
  await expect.poll(() => api.created).toBe(1)
  expect(api.books['copy-1'].snapshot).toEqual(fixture)
})
