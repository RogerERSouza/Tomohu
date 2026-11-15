import './setup.ts'
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from '@testing-library/react'
import { ContentSettings } from '../../src/features/contents/ContentSettings'
import { usePrivateItems } from '../../src/features/privacy/usePrivateItems'

afterEach(() => {
  cleanup()
  mock.restoreAll()
})
const item = (id: string) => ({
  id,
  kind: 'section',
  root_id: id,
  parent_id: null,
  position: 0,
})
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status })

test('private metadata retains the last successful list on failure and recovers on retry', async () => {
  let fail = false
  mock.method(globalThis, 'fetch', async () =>
    response(fail ? {} : [item('a')], fail ? 503 : 200),
  )
  const { result } = renderHook(() =>
    usePrivateItems('http://127.0.0.1:8000', 'token', 'book'),
  )
  await act(async () => {
    await Promise.resolve()
  })
  assert.equal(result.current.items[0]?.id, 'a')
  fail = true
  await act(async () => {
    await assert.rejects(result.current.refresh())
  })
  assert.equal(result.current.items[0]?.id, 'a')
  assert.match(result.current.error, /não foram apagados/)
  fail = false
  await act(async () => {
    await result.current.refresh()
  })
  assert.equal(result.current.error, '')
  assert.equal(result.current.items[0]?.id, 'a')
})

test('a late metadata response cannot replace the list of a different account workspace', async () => {
  let release: ((value: Response) => void) | undefined
  mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/first'))
      return new Promise<Response>((resolve) => {
        release = resolve
      })
    return response([item('second')])
  })
  const { result, rerender } = renderHook(
    ({ token, book }) => usePrivateItems('http://127.0.0.1:8000', token, book),
    { initialProps: { token: 'first-token', book: 'first' } },
  )
  await act(async () => {
    await Promise.resolve()
  })
  assert.ok(release)
  rerender({ token: 'second-token', book: 'second' })
  await act(async () => {
    await Promise.resolve()
  })
  assert.equal(result.current.items[0]?.id, 'second')
  await act(async () => {
    release?.(response([item('first')]))
  })
  assert.equal(result.current.items[0]?.id, 'second')
  rerender({ token: '', book: '' })
  assert.deepEqual(result.current.items, [])
})

for (const state of ['public', 'private'] as const) {
  test(`blank ${state} content settings use the same title fallback as the editor`, () => {
    let saved: { title: string; private: boolean } | undefined
    const view = render(
      <ContentSettings
        content={{
          id: 'c',
          sectionId: 's',
          kind: 'note',
          title: 'Valid',
          text: 'Body',
        }}
        privacyState={state}
        onSave={(title, isPrivate) => {
          saved = { title, private: isPrivate }
        }}
      />,
    )
    fireEvent.change(view.getByLabelText('Título'), {
      target: { value: '   ' },
    })
    fireEvent.click(view.getByText('Salvar alterações'))
    assert.deepEqual(saved, {
      title: 'Sem título',
      private: state === 'private',
    })
  })
}
