import { downloadJson } from '../../lib/browserFiles'
import { parseNotebookBackup } from '../../lib/notebook'
import type { Notebook } from '../../types'

export function downloadNotebook(notebook: Notebook) {
  downloadJson(
    JSON.stringify(notebook, null, 2),
    `tomohu-backup-${new Date().toISOString().slice(0, 10)}.json`,
  )
}

export async function readNotebookFile(file: File): Promise<Notebook> {
  return parseNotebookBackup(await file.text())
}
