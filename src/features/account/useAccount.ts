import { useEffect, useRef, useState } from 'react'
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
    return configured ? apiBaseUrl(configured) : ''
  } catch {
    return ''
  }
}
export function useAccount() {
  const [origin] = useState(configuredOrigin)
  const [session, setSession] = useState<{
    user: AccountUser
    token: string
    expiresAt: number
  } | null>(null)
  const [items, setItems] = useState<NotebookSummary[]>([])
  const [workspace, setWorkspace] = useState<{
    ownerId: string
    remote: RemoteNotebook
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  useEffect(() => {
    if (!session?.token) return
    const timer = setTimeout(
      () =>
        setSession((current) => (current ? { ...current, token: '' } : null)),
      Math.max(0, session.expiresAt - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [session])
  const api = session?.token ? createApiClient(origin, session.token) : null
  async function run(work: () => Promise<void>, authentication = false) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession((current) => (current ? { ...current, token: '' } : null))
        setError(
          authentication
            ? 'E-mail ou senha inválidos.'
            : apiErrorMessage(error),
        )
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
      const request = generation.current
      const guest = createApiClient(origin)
      if (register) await guest.register(email, password)
      const credentials = await guest.login(email, password)
      const client = createApiClient(origin, credentials.token)
      const [user, owned] = await Promise.all([client.me(), client.list()])
      if (request !== generation.current) return
      setSession({ user, ...credentials })
      setItems(owned)
      setWorkspace((current) => (current?.ownerId === user.id ? current : null))
      if (register)
        setNotice(
          'Conta criada. Confira o e-mail para confirmar seu endereço; o link expira em 30 minutos.',
        )
    }, true)
  }
  async function refresh() {
    if (!api) return
    await run(async () => {
      setItems(await api.list())
    })
  }
  async function refreshUser() {
    if (!api || !session) return
    await run(async () => {
      const user = await api.me()
      setSession((current) =>
        current?.token === session.token && current.user.id === user.id
          ? { ...current, user }
          : current,
      )
    })
  }
  async function open(id: string) {
    if (!api || !session) return
    await run(async () => {
      const remote = await api.get(id)
      setWorkspace({ ownerId: session.user.id, remote })
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
      let warning = ''
      if (api) {
        try {
          await api.logout()
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401))
            warning =
              'Você saiu neste navegador. Não foi possível confirmar o encerramento no servidor; a sessão remota pode continuar válida até expirar.'
        }
      }
      generation.current++
      setSession(null)
      setWorkspace(null)
      setItems([])
      setError('')
      setNotice(warning)
      window.location.hash = ''
    })
  }
  return {
    enabled: Boolean(origin),
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
    refresh,
    refreshUser,
    create,
    logout,
    expire: () =>
      setSession((current) => (current ? { ...current, token: '' } : null)),
  }
}
export type AccountController = ReturnType<typeof useAccount>
