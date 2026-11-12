import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validNewPassword } from '../src/features/account/passwordPolicy.ts'
import { readAccountLink } from '../src/features/account/accountLink.ts'

test('new password policy permits requested minimum and requires all character groups', () => {
  for (const value of ['Ab123', 'Long secure password 123!'])
    assert.equal(validNewPassword(value), true)
  for (const value of [
    '',
    'Ab1',
    'abc12',
    'ABC12',
    'Abcde',
    'A1' + 'a'.repeat(127),
  ])
    assert.equal(validNewPassword(value), false)
})
test('account action links are separate from notebook routes and bounded', () => {
  assert.deepEqual(readAccountLink('#account/reset/opaque.secret'), {
    purpose: 'reset',
    token: 'opaque.secret',
  })
  assert.deepEqual(readAccountLink('#account/verify/token'), {
    purpose: 'verify',
    token: 'token',
  })
  for (const value of [
    '#content/note',
    '#account/delete/token',
    '#account/reset/',
    '#account/reset/a/b',
    '#account/reset/' + 'a'.repeat(201),
  ])
    assert.equal(readAccountLink(value), null)
})
