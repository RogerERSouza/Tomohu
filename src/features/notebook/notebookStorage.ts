import { createInitialNotebook } from '../../data/initialNotebook'
import { parseNotebookBackup, STORAGE_KEY } from '../../lib/notebook'
import type { Notebook } from '../../types'

export function loadNotebook(): {
  notebook: Notebook
  error: string
  blocked: boolean
  raw: string | null
} {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return {
        notebook: createInitialNotebook(),
        error: '',
        blocked: false,
        raw,
      }
    const parsed = parseNotebookBackup(raw)
    return { notebook: parsed, error: '', blocked: false, raw }
  } catch {
    return {
      notebook: createInitialNotebook(),
      error:
        'Não foi possível carregar os dados deste navegador. O salvamento foi pausado para preservar o que já existia. Exporte suas alterações antes de fechar.',
      blocked: true,
      raw,
    }
  }
}

export function saveNotebook(notebook: Notebook): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook))
}
