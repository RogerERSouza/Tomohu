import type { Dispatch, SetStateAction } from 'react'
import type { Notebook } from '../../types'

export interface NotebookController {
  notebook: Notebook
  setNotebook: Dispatch<SetStateAction<Notebook>>
  replaceNotebook: (next: Notebook) => boolean
  storageError: string
}
