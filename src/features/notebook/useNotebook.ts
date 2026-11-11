import { useCallback, useEffect, useRef, useState } from 'react'
import { STORAGE_KEY } from '../../lib/notebook'
import { loadNotebook, saveNotebook } from './notebookStorage'
import type { Notebook } from '../../types'

export function useNotebook() {
  const [initial] = useState(loadNotebook)
  const [isSavingBlocked, setIsSavingBlocked] = useState(initial.blocked)
  const [notebook, setNotebook] = useState(initial.notebook)
  const [storageError, setStorageError] = useState(initial.error)
  const paused = useRef(initial.blocked)
  const stored = useRef(initial.raw)

  const pauseForExternalChange = useCallback(() => {
    paused.current = true
    try {
      localStorage.setItem(
        `tomohu.guest.recovery.${crypto.randomUUID()}`,
        JSON.stringify(notebook),
      )
    } catch {
      // The open draft remains available through the existing export button.
    }
    setIsSavingBlocked(true)
    setStorageError(
      'Outra aba alterou o caderno local. Exporte a cópia aberta antes de recarregar; a versão salva pela outra aba foi preservada.',
    )
  }, [notebook])

  function replaceNotebook(nextNotebook: Notebook): boolean {
    try {
      const current = localStorage.getItem(STORAGE_KEY)
      // Confirmed replacement preserves the displaced raw data, including corrupt backups.
      if (current !== null && (paused.current || current !== stored.current))
        localStorage.setItem(
          `tomohu.guest.recovery.${crypto.randomUUID()}`,
          current,
        )
      saveNotebook(nextNotebook)
      stored.current = JSON.stringify(nextNotebook)
      paused.current = false
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
    if (paused.current) return
    let active = true
    const reportError = (message: string) =>
      queueMicrotask(() => {
        if (active && !paused.current) setStorageError(message)
      })
    try {
      if (localStorage.getItem(STORAGE_KEY) !== stored.current) {
        queueMicrotask(() => {
          if (active) pauseForExternalChange()
        })
      } else {
        saveNotebook(notebook)
        stored.current = JSON.stringify(notebook)
        reportError('')
      }
    } catch {
      reportError(
        'Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Exporte uma cópia antes de fechar.',
      )
    }
    return () => {
      active = false
    }
  }, [notebook, isSavingBlocked, pauseForExternalChange])

  useEffect(() => {
    function changed(event: StorageEvent) {
      if (
        (event.storageArea && event.storageArea !== localStorage) ||
        (event.key !== null && event.key !== STORAGE_KEY)
      )
        return
      pauseForExternalChange()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [pauseForExternalChange])

  return { notebook, setNotebook, replaceNotebook, storageError }
}
