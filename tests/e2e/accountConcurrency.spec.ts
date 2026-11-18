import { test, expect, accountStorageKey } from './notebook.fixture'

test('account tabs preserve an external write and retain the stale tab draft', async ({
  page,
}) => {
  await page.goto('/#content/note')
  const other = await page.context().newPage()
  await other.goto('/#content/note')
  await other.getByLabel('Sua nota').fill('Written by another tab')
  await expect(page.getByRole('alert')).toContainText('Outra aba alterou')
  await page.getByLabel('Sua nota').fill('Unsaved stale-tab draft')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).snapshot.contents[0].text,
      accountStorageKey,
    ),
  ).toBe('Written by another tab')
  await page.reload()
  await expect(page.getByLabel('Sua nota')).toHaveValue(
    'Written by another tab',
  )
})

test('failed account import leaves the saved cache unchanged and reports failure in the dialog', async ({
  page,
}) => {
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    accountStorageKey,
  )
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('tomohu.account.v1.'))
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        sections: [],
        contents: [],
        reminders: [],
      }),
    ),
  })
  const dialog = page.getByRole('dialog', {
    name: 'Importar backup',
    exact: true,
  })
  await dialog
    .getByRole('button', { name: 'Substituir dados', exact: true })
    .click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(
    await page.evaluate((key) => localStorage.getItem(key), accountStorageKey),
  ).toBe(before)
})
