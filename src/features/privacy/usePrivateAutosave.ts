import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiErrorMessage } from '../../lib/api/client'
import type { Notebook } from '../../types'
import type { PrivateSnapshot } from '../../lib/api/privacy'
import type { PrivateDocument } from './privacyTypes'

export function usePrivateAutosave(
  document: PrivateDocument,
  read: () => PrivateDocument | null,
  write: (next: PrivateDocument) => void,
  persist: (snapshot: Notebook, revision: number) => Promise<PrivateSnapshot>,
) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const paused = useRef(false)
  const flight = useRef<Promise<boolean> | null>(null)
  const flush = useCallback(
    (retry = true): Promise<boolean> => {
      if (flight.current) return flight.current
      if (paused.current && !retry) return Promise.resolve(false)
      paused.current = false
      setError('')
      setSaving(true)
      const task = Promise.resolve().then(async () => {
        try {
          while (true) {
            const pending = read()
            if (
              !pending ||
              pending.item.id !== document.item.id ||
              !pending.dirty
            )
              return true
            const result = await persist(pending.snapshot, pending.revision)
            const latest = read()
            if (
              !latest ||
              latest.item.id !== pending.item.id ||
              latest.identity !== pending.identity
            )
              return true
            const changed = latest.snapshot !== pending.snapshot
            write({
              ...latest,
              revision: result.revision,
              snapshot: changed ? latest.snapshot : result.snapshot,
              dirty: changed,
            })
          }
        } catch (e) {
          paused.current = true
          setError(
            e instanceof ApiError && e.status === 409
              ? 'Este item mudou em outro dispositivo. Seu rascunho foi preservado. Exporte antes de recarregar.'
              : apiErrorMessage(e),
          )
          return false
        } finally {
          flight.current = null
          setSaving(false)
        }
      })
      flight.current = task
      return task
    },
    [document.item.id, persist, read, write],
  )
  useEffect(() => {
    if (!document.dirty || paused.current) return
    const timer = setTimeout(() => void flush(false), 350)
    return () => clearTimeout(timer)
  }, [document.snapshot, document.dirty, flush])
  return { saving, error, flush }
}
