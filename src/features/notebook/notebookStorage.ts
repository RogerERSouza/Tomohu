import { createInitialNotebook } from '../../data/initialNotebook'
import { parseNotebookBackup, STORAGE_KEY } from '../../lib/notebook'
import type { Notebook } from '../../types'

export function loadNotebook(): {
  notebook: Notebook
  error: string
  blocked: boolean
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored)
      return { notebook: createInitialNotebook(), error: '', blocked: false }
    const parsed = parseNotebookBackup(stored)
    return { notebook: parsed, error: '', blocked: false }
  } catch {
    return {
      notebook: createInitialNotebook(),
      error:
        'Não foi possível carregar os dados deste navegador. O salvamento foi pausado para preservar o que já existia. Exporte suas alterações antes de fechar.',
      blocked: true,
    }
  }
}

export function saveNotebook(notebook: Notebook): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook))
}
