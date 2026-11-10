import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Notebook } from '../../types'
import { downloadNotebook, readNotebookFile } from './backupFiles'

export function useBackupFiles(
  notebook: Notebook,
  onReady: (backup: Notebook, fileName: string) => void,
) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')
  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const backup = await readNotebookFile(file)
      setImportError('')
      onReady(backup, file.name)
    } catch {
      setImportError(
        'Não foi possível importar esse arquivo. Escolha um backup JSON válido do Tomohu.',
      )
    }
  }
  return {
    importInputRef,
    importError,
    chooseBackup,
    exportNotebook: () => downloadNotebook(notebook),
  }
}
