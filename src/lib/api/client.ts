import { AccountDataError, validateAccountData } from './limits.ts'
import { isNotebook } from '../notebookValidation.ts'
import type { Notebook } from '../../types'

export interface AccountUser {
  id: string
  email: string
}
export interface RemoteNotebook {
  id: string
  revision: number
  snapshot: Notebook
}
export type NotebookSummary = Pick<RemoteNotebook, 'id' | 'revision'> & {
  title?: string | null
}
export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`API request failed (${status})`)
    this.status = status
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value)
function summary(value: unknown): value is NotebookSummary {
  return (
    record(value) &&
    identifier(value.id) &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision > 0 &&
    (value.title === undefined ||
      value.title === null ||
      typeof value.title === 'string')
  )
}
function remote(value: unknown): RemoteNotebook {
  if (!summary(value) || !('snapshot' in value) || !isNotebook(value.snapshot))
    throw new ApiError(502)
  return { id: value.id, revision: value.revision, snapshot: value.snapshot }
}
export function apiBaseUrl(value: string): string {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ))
  )
    throw new Error('Invalid API origin')
  return url.origin
}
export function createApiClient(origin: string, token = '') {
  const base = apiBaseUrl(origin)
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${base}/api/v1${path}`, {
        method,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      throw new ApiError(0)
    }
    if (!response.ok) throw new ApiError(response.status)
    try {
      return await response.json()
    } catch {
      throw new ApiError(502)
    }
  }
  return {
    async register(email: string, password: string) {
      await request('/auth/register', 'POST', { email, password })
    },
    async login(email: string, password: string) {
      const value = await request('/auth/login', 'POST', { email, password })
      if (
        !record(value) ||
        typeof value.access_token !== 'string' ||
        !value.access_token ||
        value.token_type !== 'bearer' ||
        typeof value.expires_in !== 'number' ||
        !Number.isFinite(value.expires_in) ||
        value.expires_in <= 0 ||
        value.expires_in > 1800
      )
        throw new ApiError(502)
      return {
        token: value.access_token,
        expiresAt: Date.now() + value.expires_in * 1000,
      }
    },
    async me(): Promise<AccountUser> {
      const value = await request('/auth/me')
      if (
        !record(value) ||
        !identifier(value.id) ||
        typeof value.email !== 'string'
      )
        throw new ApiError(502)
      return { id: value.id, email: value.email }
    },
    async list(): Promise<NotebookSummary[]> {
      const value = await request('/notebooks')
      if (!Array.isArray(value) || !value.every(summary))
        throw new ApiError(502)
      return value
    },
    async get(id: string) {
      const value = remote(
        await request(`/notebooks/${encodeURIComponent(id)}`),
      )
      if (value.id !== id) throw new ApiError(502)
      return value
    },
    async create(snapshot: Notebook) {
      validateAccountData(snapshot)
      return remote(await request('/notebooks', 'POST', { snapshot }))
    },
    async save(id: string, revision: number, snapshot: Notebook) {
      validateAccountData(snapshot)
      const value = remote(
        await request(`/notebooks/${encodeURIComponent(id)}`, 'PUT', {
          revision,
          snapshot,
        }),
      )
      if (value.id !== id || value.revision !== revision + 1)
        throw new ApiError(502)
      return value
    },
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
export function apiErrorMessage(error: unknown): string {
  if (error instanceof AccountDataError) return error.message
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401)
    return 'Sessão expirada ou acesso inválido. Entre novamente; suas alterações locais foram mantidas.'
  if (status === 409)
    return 'A versão da conta mudou. Exporte sua cópia antes de resolver o conflito.'
  if (status === 422)
    return 'Os dados não atendem aos limites da conta. Exporte uma cópia e revise os campos; nada foi substituído.'
  if (status === 429)
    return 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.'
  if (status === 404)
    return 'Caderno indisponível para esta conta. Suas alterações locais foram mantidas.'
  if (status === 502)
    return 'A API retornou dados incompatíveis. Nenhum dado local foi substituído.'
  return 'Não foi possível acessar a conta. Confira a conexão e tente novamente; os dados locais foram mantidos.'
}
