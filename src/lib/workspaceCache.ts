import type { Notebook } from '../types'
import { isNotebook } from './notebookValidation.ts'

export interface WorkspaceCache {
  version: 1
  ownerId: string
  base: { id: string; revision: number; snapshot: Notebook }
  snapshot: Notebook
}

/** Decode recovery files and browser caches with the same integrity checks. */
export function readWorkspaceCache(value: unknown): WorkspaceCache {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('ownerId' in value) ||
    typeof value.ownerId !== 'string' ||
    !value.ownerId.trim() ||
    !('base' in value) ||
    !value.base ||
    typeof value.base !== 'object' ||
    !('id' in value.base) ||
    typeof value.base.id !== 'string' ||
    !value.base.id.trim() ||
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
  return {
    version: 1,
    ownerId: value.ownerId,
    base: {
      id: value.base.id,
      revision: value.base.revision,
      snapshot: value.base.snapshot,
    },
    snapshot: value.snapshot,
  }
}
