import { useEffect, useState } from 'react'
import { loadNotebook, saveNotebook } from './notebookStorage'
import type { Notebook } from '../../types'

export function useNotebook() {
  const [initial] = useState(loadNotebook)
  const [notebook, setNotebook] = useState(initial.notebook)
  const [storageError, setStorageError] = useState(initial.error)

  function replaceNotebook(nextNotebook: Notebook): boolean {
    try {
      saveNotebook(nextNotebook)
      setNotebook(nextNotebook)
      setStorageError('')
      return true
    } catch {
      setStorageError(
        'Não foi possível importar. O armazenamento pode estar cheio ou bloqueado.',
      )
      return false
    }
  }

  useEffect(() => {
    if (initial.blocked) return
    let active = true
    const reportError = (message: string) =>
      queueMicrotask(() => {
        if (active) setStorageError(message)
      })
    try {
      saveNotebook(notebook)
      reportError('')
    } catch {
      reportError(
        'Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Exporte uma cópia antes de fechar.',
      )
    }
    return () => {
      active = false
    }
  }, [notebook, initial.blocked])

  return { notebook, setNotebook, replaceNotebook, storageError }
}
