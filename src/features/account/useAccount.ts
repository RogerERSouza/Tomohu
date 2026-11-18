import {
  locallySignedOut,
  rememberSignOut,
  signOutPreferenceKey,
} from './signOutPreference'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  apiBaseUrl,
  apiErrorMessage,
  createApiClient,
} from '../../lib/api/client'
import type {
  AccountUser,
  NotebookSummary,
  RemoteNotebook,
} from '../../lib/api/client'
import type { Notebook } from '../../types'

const configured = import.meta.env.VITE_API_BASE_URL ?? ''
function configuredOrigin() {
  try {
    if (!configured) return ''
    const url = new URL(apiBaseUrl(configured))
    const loopback = ['localhost', '127.0.0.1', '[::1]']
    if (
      url.protocol === 'http:' &&
      loopback.includes(url.hostname) &&
      loopback.includes(window.location.hostname)
    )
      url.hostname = window.location.hostname
    return url.origin
  } catch {
    return ''
  }
}
type Session = { user: AccountUser; token: string; expiresAt: number }

export function useAccount() {
  const [origin] = useState(configuredOrigin)
  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<NotebookSummary[]>([])
  const [workspace, setWorkspace] = useState<{
    ownerId: string
    remote: RemoteNotebook
  } | null>(null)
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(Boolean(origin))
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  const generation = useRef({ value: 0 })
  const sessionRef = useRef<Session | null>(null)
  const renewal = useRef<Promise<void> | null>(null)
  const remember = useCallback((value: Session | null) => {
    sessionRef.current = value
    setSession(value)
  }, [])
  const expire = useCallback(() => {
    generation.current.value++
    setStarting(false)
    const current = sessionRef.current
    remember(current ? { ...current, token: '' } : null)
    setOffline(false)
  }, [remember])
  const resume = useCallback((): Promise<void> => {
    if (!origin) return Promise.resolve()
    if (renewal.current) return renewal.current
    if (locallySignedOut()) {
      setStarting(false)
      return Promise.resolve()
    }
    const request = generation.current.value
    const task = Promise.resolve().then(async () => {
      try {
        const credentials = await createApiClient(origin).renew()
        const client = createApiClient(origin, credentials.token)
        const [user, owned] = await Promise.all([client.me(), client.list()])
        if (request !== generation.current.value) return
        const current = sessionRef.current
        if (current && current.user.id !== user.id) {
          expire()
          setError(
            'A conta mudou em outra aba. Entre novamente para continuar; seus rascunhos foram preservados.',
          )
          return
        }
        const first = await client.bootstrap()
        if (request !== generation.current.value) return
        remember({ user, ...credentials })
        setItems(
          owned.length ? owned : [{ id: first.id, revision: first.revision }],
        )
        setWorkspace((previous) =>
          previous?.ownerId === user.id
            ? previous
            : { ownerId: user.id, remote: first },
        )
        setOffline(false)
        setError('')
      } catch (error) {
        if (request !== generation.current.value) return
        if (error instanceof ApiError && error.status === 0) {
          setOffline(Boolean(sessionRef.current?.token))
          setError(
            'Sem conexão com a conta. Tente novamente quando a conexão voltar.',
          )
        } else {
          expire()
          if (!(error instanceof ApiError) || error.status !== 401)
            setError(apiErrorMessage(error))
        }
      } finally {
        if (request === generation.current.value) setStarting(false)
        if (renewal.current === task) renewal.current = null
      }
    })
    renewal.current = task
    return task
  }, [origin, remember, expire])
  useEffect(() => {
    let active = true
    const sequence = generation.current
    queueMicrotask(() => {
      if (active) void resume()
    })
    return () => {
      active = false
      sequence.value++
    }
  }, [resume])
  useEffect(() => {
    if (!session?.token || offline) return
    const timer = setTimeout(
      () => void resume(),
      Math.max(1000, session.expiresAt - Date.now() - 60000),
    )
    return () => clearTimeout(timer)
  }, [session, offline, resume])
  useEffect(() => {
    const online = () => {
      if (sessionRef.current?.token) void resume()
    }
    const offline = () => setOffline(Boolean(sessionRef.current?.token))
    const visible = () => {
      if (
        document.visibilityState === 'visible' &&
        sessionRef.current?.token &&
        Date.now() >= sessionRef.current.expiresAt - 60000
      )
        void resume()
    }
    const signedOutElsewhere = (event: StorageEvent) => {
      if (event.key === signOutPreferenceKey && event.newValue) expire()
    }
    window.addEventListener('storage', signedOutElsewhere)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('storage', signedOutElsewhere)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [resume, expire])
  const connectionLost = useCallback(
    () => setOffline(Boolean(session?.token)),
    [session?.token],
  )
  const api =
    session?.token && !offline
      ? createApiClient(origin, session.token, connectionLost)
      : null
  async function run(work: () => Promise<void>, authentication = false) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (!authentication) expire()
        setError(
          authentication
            ? 'E-mail ou senha inválidos.'
            : apiErrorMessage(error),
        )
      } else if (error instanceof ApiError && error.status === 0) {
        setOffline(Boolean(sessionRef.current?.token))
        setError(apiErrorMessage(error))
      } else if (
        authentication &&
        error instanceof ApiError &&
        error.status === 409
      )
        setError(
          'Não foi possível criar a conta com esses dados. Tente entrar ou use outro e-mail.',
        )
      else if (
        authentication &&
        error instanceof ApiError &&
        error.status === 422
      )
        setError(
          'Confira o e-mail e a senha. Para criar uma senha, use de 5 a 128 caracteres, com maiúscula, minúscula e número.',
        )
      else setError(apiErrorMessage(error))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function authenticate(
    email: string,
    password: string,
    register: boolean,
  ) {
    setNotice('')
    await run(async () => {
      if (renewal.current) await renewal.current
      const request = ++generation.current.value
      const guest = createApiClient(origin)
      if (register) await guest.register(email, password)
      const credentials = await guest.browserLogin(email, password)
      const client = createApiClient(origin, credentials.token)
      const [user, first] = await Promise.all([client.me(), client.bootstrap()])
      const owned = await client.list()
      if (request !== generation.current.value) return
      remember({ user, ...credentials })
      setItems(
        owned.length ? owned : [{ id: first.id, revision: first.revision }],
      )
      setWorkspace((current) =>
        current?.ownerId === user.id
          ? current
          : { ownerId: user.id, remote: first },
      )
      setOffline(false)
      setStarting(false)
      rememberSignOut(false)
      if (register)
        setNotice(
          'Conta criada. Confira o e-mail para confirmar seu endereço; o link expira em 30 minutos.',
        )
    }, true)
  }
  async function refresh() {
    if (api) await run(async () => setItems(await api.list()))
  }
  async function refreshUser() {
    if (!api || !session) return
    await run(async () => {
      const user = await api.me()
      if (sessionRef.current?.token === session.token)
        remember({ ...session, user })
    })
  }
  async function open(id: string) {
    if (!api || !session) return
    await run(async () => {
      setWorkspace({ ownerId: session.user.id, remote: await api.get(id) })
      setWorkspaceEpoch((value) => value + 1)
      window.location.hash = ''
    })
  }
  async function create(snapshot: Notebook) {
    if (!api || !session) return
    await run(async () => {
      const remote = await api.create(snapshot)
      setItems((current) => [
        ...current,
        { id: remote.id, revision: remote.revision },
      ])
      setWorkspace({ ownerId: session.user.id, remote })
      setWorkspaceEpoch((value) => value + 1)
      window.location.hash = ''
    })
  }
  async function requestReset(email: string) {
    setError('')
    try {
      await createApiClient(origin).requestReset(email)
    } catch (error) {
      setError(apiErrorMessage(error))
      throw error
    }
  }
  async function logout() {
    if (pending.current) return
    await run(async () => {
      if (renewal.current) await renewal.current
      generation.current.value++
      let confirmed = false
      try {
        await createApiClient(origin).browserLogout()
        confirmed = true
      } catch {
        /* Attempt independent bearer revocation below. */
      }
      if (api) {
        try {
          await api.logout()
          confirmed = true
        } catch (error) {
          if (error instanceof ApiError && error.status === 401)
            confirmed = true
        }
      }
      if (!confirmed)
        setNotice(
          'Você saiu neste navegador. Não foi possível confirmar o encerramento no servidor; reconecte e encerre a sessão remota nas configurações de segurança.',
        )
      rememberSignOut(true)
      remember(null)
      setOffline(false)
      setWorkspace(null)
      setItems([])
      setWorkspaceEpoch((value) => value + 1)
      window.location.hash = ''
    })
  }
  return {
    workspaceEpoch,
    enabled: Boolean(origin),
    starting,
    offline,
    resume,
    connectionLost,
    session,
    items,
    workspace,
    busy,
    error,
    notice,
    setNotice,
    requestReset,
    api,
    perform: run,
    authenticate,
    open,
    acceptRemote: (remote: RemoteNotebook) => {
      if (session?.token && !offline)
        setWorkspace({ ownerId: session.user.id, remote })
    },
    refresh,
    refreshUser,
    create,
    logout,
    expire,
  }
}
export type AccountController = ReturnType<typeof useAccount>
