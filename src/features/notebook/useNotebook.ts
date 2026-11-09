import { useEffect, useState } from 'react'
import { loadNotebook, saveNotebook } from './notebookStorage'
import type { Notebook } from '../../types'

export function useNotebook() {
  const [initial] = useState(loadNotebook)
  const [isSavingBlocked, setIsSavingBlocked] = useState(initial.blocked)
  const [notebook, setNotebook] = useState(initial.notebook)
  const [storageError, setStorageError] = useState(initial.error)

  function replaceNotebook(nextNotebook: Notebook): boolean {
    try {
      saveNotebook(nextNotebook)
      setNotebook(nextNotebook)
      setIsSavingBlocked(false)
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
    if (isSavingBlocked) return
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
  }, [notebook, isSavingBlocked])

  return { notebook, setNotebook, replaceNotebook, storageError }
}
