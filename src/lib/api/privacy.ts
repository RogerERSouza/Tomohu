import { parseRemoteNotebook } from './remoteNotebook.ts'
import type { Notebook, Section } from '../../types'
import { isNotebook } from '../notebookValidation.ts'
import { ApiError } from './errors.ts'
import { record, identifier } from './validation.ts'

export interface PrivateSummary {
  id: string
  kind: 'section' | 'content'
  root_id: string
  position: number
  parent_id: string | null
  title?: string
}
export interface PrivateSnapshot {
  snapshot: Notebook
  revision: number
}

function isPrivateSummary(value: unknown): value is PrivateSummary {
  return (
    record(value) &&
    identifier(value.id) &&
    identifier(value.root_id) &&
    Number.isSafeInteger(value.position) &&
    Number(value.position) >= 0 &&
    (value.kind === 'section' || value.kind === 'content') &&
    (value.parent_id === null || identifier(value.parent_id)) &&
    (value.title === undefined || typeof value.title === 'string')
  )
}

type Request = (
  path: string,
  method?: string,
  body?: unknown,
  privacyToken?: string,
) => Promise<unknown>
export function privacyApi(request: Request) {
  return {
    async privacyStatus(): Promise<boolean> {
      const value = await request('/privacy/status')
      if (!record(value) || typeof value.configured !== 'boolean')
        throw new ApiError(502)
      return value.configured
    },
    async privacyPassword(password: string, currentPassword?: string) {
      await request('/privacy/password', 'POST', {
        password,
        ...(currentPassword ? { current_password: currentPassword } : {}),
      })
    },
    async privacyUnlock(password: string): Promise<string> {
      const value = await request('/privacy/unlock', 'POST', { password })
      if (
        !record(value) ||
        typeof value.token !== 'string' ||
        !value.token ||
        value.token.length > 4096
      )
        throw new ApiError(502)
      return value.token
    },
    async privacyResetRequest() {
      await request('/privacy/reset-request', 'POST')
    },
    async privacyReset(token: string, password: string) {
      await request('/privacy/reset', 'POST', { token, password })
    },
    async privateItems(
      notebookId: string,
      grant = '',
    ): Promise<PrivateSummary[]> {
      const value = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}`,
        'GET',
        undefined,
        grant,
      )
      if (!Array.isArray(value) || !value.every(isPrivateSummary))
        throw new ApiError(502)
      return value.map((v) => ({
        id: v.id,
        kind: v.kind,
        parent_id: v.parent_id,
        root_id: v.root_id,
        position: v.position,
        ...(v.title === undefined ? {} : { title: v.title }),
      }))
    },
    async protectItem(
      notebookId: string,
      kind: 'section' | 'content',
      rootId: string,
      revision: number,
      grant: string,
      updates?: { section?: Section; title?: string },
    ) {
      const result = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}`,
        'POST',
        { kind, root_id: rootId, revision, ...updates },
        grant,
      )
      if (!record(result) || !identifier(result.id)) throw new ApiError(502)
      return { id: result.id, notebook: parseRemoteNotebook(result.notebook) }
    },
    async privateCreate(
      notebookId: string,
      payload: {
        kind: 'section' | 'content'
        root_id: string
        parent_id: string | null
        revision: number
        snapshot: Notebook
      },
      grant: string,
    ) {
      const result = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}/create`,
        'POST',
        payload,
        grant,
      )
      if (!record(result) || !identifier(result.id)) throw new ApiError(502)
      return { id: result.id, notebook: parseRemoteNotebook(result.notebook) }
    },
    async privateRead(
      notebookId: string,
      id: string,
      grant: string,
    ): Promise<PrivateSnapshot> {
      const value = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(id)}`,
        'GET',
        undefined,
        grant,
      )
      if (
        !record(value) ||
        !isNotebook(value.snapshot) ||
        !Number.isSafeInteger(value.revision) ||
        Number(value.revision) < 1
      )
        throw new ApiError(502)
      return { snapshot: value.snapshot, revision: Number(value.revision) }
    },
    async privateSave(
      notebookId: string,
      id: string,
      payload: PrivateSnapshot,
      grant: string,
    ) {
      const value = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(id)}`,
        'PUT',
        payload,
        grant,
      )
      if (
        !record(value) ||
        !isNotebook(value.snapshot) ||
        !Number.isSafeInteger(value.revision) ||
        Number(value.revision) < 1
      )
        throw new ApiError(502)
      return { snapshot: value.snapshot, revision: Number(value.revision) }
    },
    async privateRemove(
      notebookId: string,
      id: string,
      revision: number,
      grant: string,
    ) {
      await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(id)}?revision=${revision}`,
        'DELETE',
        undefined,
        grant,
      )
    },
    async privateRestore(
      notebookId: string,
      id: string,
      revision: number,
      itemRevision: number,
      grant: string,
    ) {
      const result = await request(
        `/privacy/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(id)}/restore`,
        'POST',
        { revision, item_revision: itemRevision },
        grant,
      )
      if (!record(result)) throw new ApiError(502)
      return parseRemoteNotebook(result.notebook)
    },
  }
}
