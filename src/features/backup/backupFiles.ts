import { parseNotebookBackup } from '../../lib/notebook'
import type { Notebook } from '../../types'

export function downloadNotebook(notebook: Notebook) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(notebook, null, 2)], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `tomohu-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readNotebookFile(file: File): Promise<Notebook> {
  return parseNotebookBackup(await file.text())
}
