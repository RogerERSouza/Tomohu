import type { Notebook } from '../../types'
import { isNotebook } from '../notebookValidation.ts'
import { ApiError } from './errors.ts'
import { identifier, record } from './validation.ts'

export interface RemoteNotebook {
  id: string
  revision: number
  snapshot: Notebook
}
export function parseRemoteNotebook(value: unknown): RemoteNotebook {
  if (
    !record(value) ||
    !identifier(value.id) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !isNotebook(value.snapshot)
  )
    throw new ApiError(502)
  return { id: value.id, revision: value.revision, snapshot: value.snapshot }
}
