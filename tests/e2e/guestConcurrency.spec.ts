import { test, expect, storageKey } from './notebook.fixture'

test('guest tabs preserve an external edit when the stale tab changes a different field', async ({
  page,
  context,
}) => {
  const other = await context.newPage()
  await other.goto('/#content/note')
  await other.getByLabel('Sua nota').fill('Draft from the second guest tab')
  await expect
    .poll(() => other.evaluate((key) => localStorage.getItem(key), storageKey))
    .toContain('Draft from the second guest tab')
  await other.close()
  await page.getByLabel('Fixar Beta no topo').click()
  const cached = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  )
  expect(cached).toContain('Draft from the second guest tab')
  await expect(page.getByRole('alert')).toContainText('Outra aba')
  const downloading = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar cópia', exact: true })
    .click()
  await downloading
  await page.reload()
  await page.goto('/#content/note')
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Draft from the second guest tab',
  )
})

test('failed import keeps the current data and explains the failure inside the dialog', async ({
  page,
}) => {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key) ?? '',
    storageKey,
  )
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'recovery.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  })
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key)
        throw new DOMException('Storage full', 'QuotaExceededError')
      original.call(this, name, value)
    }
  }, storageKey)
  await page
    .getByRole('button', { name: 'Substituir dados', exact: true })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Não foi possível importar',
  )
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(raw)
})
