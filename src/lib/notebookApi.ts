import { isNotebook } from './notebook.ts'
import type { Notebook } from '../types'

export interface RemoteNotebook {
  id: string
  revision: number
  snapshot: Notebook
}

export class NotebookApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'NotebookApiError'
  }
}

const NOTEBOOK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireLocalApi(url: string): string {
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  ) {
    throw new Error('A API de desenvolvimento deve usar HTTP local, sem credenciais.')
  }
  return parsed.origin
}

function parseResponse(value: unknown): RemoteNotebook {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Resposta inválida da API.')
  const result = value as Record<string, unknown>
  if (
    typeof result.id !== 'string' ||
    !NOTEBOOK_ID.test(result.id) ||
    typeof result.revision !== 'number' ||
    !Number.isSafeInteger(result.revision) ||
    result.revision < 1 ||
    !isNotebook(result.snapshot)
  ) {
    throw new Error('A API retornou um caderno inválido.')
  }
  return {
    id: result.id,
    revision: result.revision,
    snapshot: result.snapshot,
  }
}

async function request(
  origin: string,
  path: string,
  init: RequestInit,
): Promise<RemoteNotebook> {
  // Validate before issuing any request, including when called with a malformed URL.
  const base = requireLocalApi(origin)
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new NotebookApiError(
      'Não foi possível conectar à API local. Confira se o backend está iniciado.',
      0,
    )
  }
  if (!response.ok) {
    if (response.status === 409)
      throw new NotebookApiError(
        'Conflito: a cópia remota foi alterada. Recarregue antes de tentar novamente.',
        409,
      )
    throw new NotebookApiError(
      `A API respondeu com erro HTTP ${response.status}.`,
      response.status,
    )
  }
  try {
    return parseResponse(await response.json())
  } catch {
    throw new NotebookApiError('A API retornou dados inválidos.', response.status)
  }
}

/** Creates an independent remote copy. Never modifies browser storage. */
export function createRemoteNotebook(origin: string, snapshot: Notebook) {
  if (!isNotebook(snapshot)) throw new Error('O caderno local é inválido.')
  return request(origin, '/api/v1/notebooks', {
    method: 'POST',
    body: JSON.stringify({ snapshot }),
  })
}

export function loadRemoteNotebook(origin: string, id: string) {
  if (!NOTEBOOK_ID.test(id)) throw new Error('Identificador inválido.')
  return request(origin, `/api/v1/notebooks/${id}`, { method: 'GET' })
}

export function updateRemoteNotebook(
  origin: string,
  remote: RemoteNotebook,
  snapshot: Notebook,
) {
  if (!isNotebook(snapshot)) throw new Error('O caderno local é inválido.')
  if (
    !NOTEBOOK_ID.test(remote.id) ||
    !Number.isSafeInteger(remote.revision) ||
    remote.revision < 1
  )
    throw new Error('Referência remota inválida.')
  return request(origin, `/api/v1/notebooks/${remote.id}`, {
    method: 'PUT',
    body: JSON.stringify({ revision: remote.revision, snapshot }),
  })
}
