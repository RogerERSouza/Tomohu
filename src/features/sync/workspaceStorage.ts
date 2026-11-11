import { isNotebook } from '../../lib/notebookValidation.ts'
import type { RemoteNotebook } from '../../lib/api/client.ts'
import type { Notebook } from '../../types'

export interface WorkspaceCache {
  version: 1
  ownerId: string
  base: RemoteNotebook
  snapshot: Notebook
}
export const workspaceKey = (ownerId: string, id: string) =>
  `tomohu.account.v1.${ownerId}.${id}`
function comparableNotebook(notebook: Notebook) {
  // A successful transfer may canonicalize a legacy counter timestamp.
  return JSON.stringify(notebook, (key, value: unknown) => {
    if (
      key === 'createdAt' &&
      typeof value === 'string' &&
      Number.isFinite(Date.parse(value))
    )
      return new Date(value).toISOString()
    if (value && typeof value === 'object' && !Array.isArray(value))
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      )
    return value
  })
}
export const sameNotebook = (a: Notebook, b: Notebook) =>
  comparableNotebook(a) === comparableNotebook(b)
export function loadWorkspace(ownerId: string, remote: RemoteNotebook) {
  const fallback: WorkspaceCache = {
    version: 1,
    ownerId,
    base: remote,
    snapshot: remote.snapshot,
  }
  let raw: string | null = null
  try {
    raw = localStorage.getItem(workspaceKey(ownerId, remote.id))
    if (!raw) return { cache: fallback, conflict: false, blocked: false, raw }
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== 1 ||
      !('ownerId' in value) ||
      value.ownerId !== ownerId ||
      !('base' in value) ||
      !value.base ||
      typeof value.base !== 'object' ||
      !('id' in value.base) ||
      value.base.id !== remote.id ||
      !('revision' in value.base) ||
      typeof value.base.revision !== 'number' ||
      !Number.isSafeInteger(value.base.revision) ||
      value.base.revision < 1 ||
      !('snapshot' in value.base) ||
      !isNotebook(value.base.snapshot) ||
      !('snapshot' in value) ||
      !isNotebook(value.snapshot)
    )
      throw new Error('Invalid workspace cache')
    const cache: WorkspaceCache = {
      version: 1,
      ownerId,
      base: {
        id: remote.id,
        revision: value.base.revision,
        snapshot: value.base.snapshot,
      },
      snapshot: value.snapshot,
    }
    if (sameNotebook(cache.snapshot, cache.base.snapshot))
      return { cache: fallback, conflict: false, blocked: false, raw }
    return {
      cache,
      raw,
      conflict: cache.base.revision !== remote.revision,
      blocked: false,
    }
  } catch {
    return { cache: fallback, conflict: false, blocked: true, raw }
  }
}
export function saveWorkspace(cache: WorkspaceCache) {
  localStorage.setItem(
    workspaceKey(cache.ownerId, cache.base.id),
    JSON.stringify(cache),
  )
}
