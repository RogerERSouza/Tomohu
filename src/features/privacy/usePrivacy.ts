import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  apiErrorMessage,
  createApiClient,
} from '../../lib/api/client'
import type { Notebook, Section } from '../../types'
import type { PrivateSummary } from '../../lib/api/privacy'
import type { AccountController } from '../account/useAccount'
import type { PrivateCreation, PrivateDocument } from './privacyTypes'

type Intent =
  | { kind: 'open'; id: string; configure?: boolean }
  | { kind: 'area' }
  | {
      kind: 'protect'
      itemKind: 'section' | 'content'
      id: string
      revision: number
      updates?: { section?: Section; title?: string }
    }
  | { kind: 'create'; payload: PrivateCreation }
const origin = import.meta.env.VITE_API_BASE_URL ?? ''
export function usePrivacy(account: AccountController) {
  const token = account.session?.token ?? ''
  const book = account.workspace?.remote
  const identity = `${account.session?.user.id ?? ''}:${book?.id ?? ''}`
  const context = `${token}:${book?.id ?? ''}`
  const [items, setItems] = useState<PrivateSummary[]>([])
  const [loaded, setLoaded] = useState('')
  const [document, setDocument] = useState<PrivateDocument | null>(null)
  const documentRef = useRef<PrivateDocument | null>(null)
  const [grant, setGrant] = useState<{
    token: string
    context: string
    expires: number
  } | null>(null)
  const [prompt, setPrompt] = useState<Intent | null>(null)
  const [area, setArea] = useState(false)
  const [returnRoute, setReturnRoute] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'inline' | 'area'>(() => {
    try {
      return localStorage.getItem('tomohu.privacy.display') === 'area'
        ? 'area'
        : 'inline'
    } catch {
      return 'inline'
    }
  })
  const current = useRef(context)
  const pending = useRef(false)
  const flusher = useRef<(() => Promise<boolean>) | null>(null)
  const read = useCallback(() => documentRef.current, [])
  const write = useCallback((next: PrivateDocument | null) => {
    documentRef.current = next
    setDocument(next)
  }, [])
  const registerFlush = useCallback((callback: () => Promise<boolean>) => {
    flusher.current = callback
    return () => {
      if (flusher.current === callback) flusher.current = null
    }
  }, [])
  const unlocked = Boolean(grant && grant.context === context)
  useEffect(() => {
    current.current = context
    queueMicrotask(() => {
      if (current.current === context) {
        setPrompt(null)
        setArea(false)
        setError('')
        setNotice('')
        setConfigured(null)
      }
    })
  }, [context])
  useEffect(() => {
    if (!grant) return
    const expire = () => {
      if (Date.now() >= grant.expires) setGrant(null)
    }
    const timer = setTimeout(expire, Math.max(0, grant.expires - Date.now()))
    window.addEventListener('focus', expire)
    window.document.addEventListener('visibilitychange', expire)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', expire)
      window.document.removeEventListener('visibilitychange', expire)
    }
  }, [grant])
  useEffect(() => {
    if (!document?.dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [document?.dirty])
  useEffect(() => {
    let active = true
    if (token && book?.id)
      void createApiClient(origin, token)
        .privateItems(book.id)
        .then((value) => {
          if (active) {
            setItems(value)
            setLoaded(context)
          }
        })
        .catch(() => {
          if (active) {
            setItems([])
            setLoaded(context)
          }
        })
    return () => {
      active = false
    }
  }, [token, book?.id, context])
  async function run(work: () => Promise<void>): Promise<boolean> {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      return true
    } catch (e) {
      if (current.current !== context) return false
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setGrant(null)
        if (e.status === 401) account.expire()
      }
      setError(
        e instanceof ApiError && e.status === 403
          ? 'Senha de privacidade incorreta ou desbloqueio expirado. Confira também a verificação do e-mail da conta.'
          : e instanceof ApiError
            ? apiErrorMessage(e)
            : e instanceof Error
              ? e.message
              : 'Não foi possível concluir.',
      )
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function flush() {
    if (flusher.current) {
      if (!(await flusher.current()))
        throw new Error(
          'Seu rascunho privado não foi salvo. Tente novamente ou exporte antes de sair.',
        )
    } else if (read()?.dirty)
      throw new Error(
        'Desbloqueie o item para salvar o rascunho pendente antes de abrir outro.',
      )
  }
  async function refresh(secret = '') {
    if (!token || !book) return []
    const value = await createApiClient(origin, token).privateItems(
      book.id,
      secret,
    )
    if (current.current === context) {
      setItems(value)
      setLoaded(context)
    }
    return value
  }
  async function openWithGrant(id: string, secret: string, configure = false) {
    if (!token || !book) return
    const list = await refresh(secret)
    const item = list.find((value) => value.id === id)
    if (!item)
      throw new Error(
        'Este item privado não está mais disponível. Recarregue o caderno.',
      )
    const previous = read()
    if (previous?.dirty && previous.item.id !== id) await flush()
    const retained = read()
    const data =
      retained?.dirty &&
      retained.identity === identity &&
      retained.item.id === id
        ? retained
        : await createApiClient(origin, token).privateRead(book.id, id, secret)
    if (current.current !== context) return
    write({
      ...data,
      item,
      identity,
      configure,
      dirty:
        retained?.identity === identity && retained.item.id === id
          ? retained.dirty
          : false,
    })
    setPrompt(null)
    setArea(false)
    window.location.hash = `${item.kind}/${item.root_id}`
  }
  async function execute(intent: Intent, secret: string) {
    if (!token || !book) return
    const api = createApiClient(origin, token)
    if (intent.kind === 'area') {
      await refresh(secret)
      setPrompt(null)
      setArea(true)
      return
    }
    if (intent.kind === 'open') {
      await openWithGrant(intent.id, secret, Boolean(intent.configure))
      return
    }
    await flush()
    const result =
      intent.kind === 'create'
        ? await api.privateCreate(book.id, intent.payload, secret)
        : await api.protectItem(
            book.id,
            intent.itemKind,
            intent.id,
            intent.revision,
            secret,
            intent.updates,
          )
    if (current.current !== context) return
    account.acceptRemote(result.notebook)
    setPrompt({ kind: 'open', id: result.id })
    await openWithGrant(result.id, secret)
  }
  function ask(intent: Intent, backHash = window.location.hash) {
    setReturnRoute(backHash)
    setError('')
    setNotice('')
    setPrompt(intent)
  }
  async function unlock(password: string) {
    if (!token || !prompt) return
    const intent = prompt
    await run(async () => {
      const secret = await createApiClient(origin, token).privacyUnlock(
        password,
      )
      if (current.current !== context) return
      setGrant({ token: secret, context, expires: Date.now() + 300000 })
      await execute(intent, secret)
    })
  }
  async function close(hash = '', discard = false) {
    return run(async () => {
      if (!discard) await flush()
      write(null)
      setGrant(null)
      setArea(false)
      window.location.hash = hash.replace(/^#/, '')
    })
  }
  const persist = useCallback(
    async (snapshot: Notebook, revision: number) => {
      if (!book || !grant || grant.context !== context) throw new ApiError(403)
      try {
        return await createApiClient(origin, token).privateSave(
          book.id,
          read()?.item.id ?? '',
          { snapshot, revision },
          grant.token,
        )
      } catch (e) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setGrant(null)
          if (e.status === 401) account.expire()
        }
        throw e
      }
    },
    [book, grant, context, token, read, account],
  )
  async function restore() {
    if (!token || !book || !grant) return
    await run(async () => {
      await flush()
      const doc = read()
      if (!doc) return
      const api = createApiClient(origin, token)
      const latest = await api.get(book.id)
      const restored = await api.privateRestore(
        book.id,
        doc.item.id,
        latest.revision,
        doc.revision,
        grant.token,
      )
      if (current.current !== context) return
      write(null)
      setGrant(null)
      await refresh()
      account.acceptRemote(restored)
      window.location.hash = `${doc.item.kind}/${doc.item.root_id}`
    })
  }
  async function reload() {
    if (!token || !book || !grant) return
    await run(async () => {
      const doc = read()
      if (!doc) return
      const value = await createApiClient(origin, token).privateRead(
        book.id,
        doc.item.id,
        grant.token,
      )
      if (current.current === context) write({ ...doc, ...value, dirty: false })
    })
  }
  async function remove() {
    if (!token || !book || !grant) return
    await run(async () => {
      await flush()
      const doc = read()
      if (!doc) return
      await createApiClient(origin, token).privateRemove(
        book.id,
        doc.item.id,
        doc.revision,
        grant.token,
      )
      if (current.current !== context) return
      write(null)
      setGrant(null)
      await refresh()
      window.location.hash = doc.item.parent_id
        ? `section/${doc.item.parent_id}`
        : ''
    })
  }
  return {
    items: loaded === context ? items : [],
    opened: unlocked && document?.identity === identity ? document : null,
    unlocked,
    busy,
    error,
    notice,
    configured,
    mode,
    prompt,
    area: area && unlocked,
    read,
    write,
    registerFlush,
    persist,
    close,
    restore,
    remove,
    reload,
    unlock,
    reportError: (message: string) => setError(message),
    cancelPrompt: () => {
      setPrompt(null)
      window.location.hash = returnRoute.replace(/^#/, '')
    },
    closeArea: () => {
      setArea(false)
      setGrant(null)
    },
    open: (id: string, configure = false, backHash?: string) =>
      ask({ kind: 'open', id, configure }, backHash),
    openFromArea: (id: string) => {
      if (unlocked && grant) void run(() => openWithGrant(id, grant.token))
      else ask({ kind: 'open', id })
    },
    openArea: () => ask({ kind: 'area' }),
    protect: (
      itemKind: 'section' | 'content',
      id: string,
      revision: number,
      updates?: { section?: Section; title?: string },
    ) => ask({ kind: 'protect', itemKind, id, revision, updates }),
    create: (payload: PrivateCreation) => ask({ kind: 'create', payload }),
    setMode: (next: 'inline' | 'area') => {
      setMode(next)
      try {
        localStorage.setItem('tomohu.privacy.display', next)
      } catch {
        setError('Não foi possível salvar a preferência.')
      }
    },
    status: async () => {
      if (token)
        await run(async () =>
          setConfigured(await createApiClient(origin, token).privacyStatus()),
        )
    },
    password: async (password: string, currentPassword?: string) => {
      if (token)
        await run(async () => {
          await createApiClient(origin, token).privacyPassword(
            password,
            currentPassword,
          )
          setConfigured(true)
          setGrant(null)
          setNotice(
            'Senha de privacidade salva. A senha da conta não foi alterada.',
          )
        })
    },
    reset: async () => {
      if (token)
        await run(async () => {
          await createApiClient(origin, token).privacyResetRequest()
          setNotice(
            'Link enviado ao e-mail verificado da conta para redefinir apenas a senha de privacidade.',
          )
        })
    },
    lock: () => setGrant(null),
    hasDraft: Boolean(document?.dirty && document.identity === identity),
  }
}
export type PrivacyController = ReturnType<typeof usePrivacy>
