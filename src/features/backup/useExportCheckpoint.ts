import { useState } from 'react'
import { downloadNotebook } from './backupFiles'
import type { Notebook } from '../../types'

export function useExportCheckpoint(notebook: Notebook) {
  const [exported, setExported] = useState('')
  return {
    hasExported: Boolean(exported) && exported === JSON.stringify(notebook),
    exportNotebook() {
      downloadNotebook(notebook)
      setExported(JSON.stringify(notebook))
    },
  }
}
