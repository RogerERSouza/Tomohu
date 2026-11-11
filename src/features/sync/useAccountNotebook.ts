import { useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import { ApiError, apiErrorMessage } from '../../lib/api/client'
import type { ApiClient, RemoteNotebook } from '../../lib/api/client'
import type { Notebook } from '../../types'
import {
  loadWorkspace,
  sameNotebook,
  saveWorkspace,
  workspaceKey,
} from './workspaceStorage'

export function useAccountNotebook(
  ownerId: string,
  remote: RemoteNotebook,
  api: ApiClient | null,
  onExpired: () => void,
) {
  const [initial] = useState(() => loadWorkspace(ownerId, remote))
  const [notebook, setNotebook] = useState(initial.cache.snapshot)
  const [base, setBase] = useState(initial.cache.base)
  const [blocked, setBlocked] = useState(initial.blocked)
  const [conflict, setConflict] = useState(initial.conflict)
  const [storageError, setStorageError] = useState(
    initial.blocked
      ? 'O cache desta conta está inválido. O salvamento foi pausado; exporte o cache preservado antes de recuperar.'
      : '',
  )
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  const dirty = !sameNotebook(notebook, base.snapshot)
  useEffect(() => {
    if (blocked) return
    let active = true
    try {
      saveWorkspace({ version: 1, ownerId, base, snapshot: notebook })
    } catch {
      queueMicrotask(() => {
        if (active)
          setStorageError(
            'Não foi possível salvar a cópia desta conta no navegador. Exporte antes de sair.',
          )
      })
    }
    return () => {
      active = false
    }
  }, [base, notebook, ownerId, blocked])
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key !== workspaceKey(ownerId, base.id)) return
      try {
        localStorage.setItem(
          `tomohu.recovery.${ownerId}.${base.id}.${crypto.randomUUID()}`,
          JSON.stringify({ version: 1, ownerId, base, snapshot: notebook }),
        )
      } catch {
        /* The open snapshot remains exportable when storage is unavailable. */
      }
      setBlocked(true)
      setStorageError(
        'Outra aba alterou este caderno. O salvamento foi pausado; exporte a cópia aberta antes de recuperar.',
      )
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [ownerId, base, notebook])
  function replaceNotebook(snapshot: Notebook) {
    if (blocked) {
      setMessage(
        'Exporte o cache preservado e recupere a versão da conta antes de importar.',
      )
      return false
    }
    try {
      saveWorkspace({ version: 1, ownerId, base, snapshot })
      setNotebook(snapshot)
      setStorageError('')
      return true
    } catch {
      setStorageError(
        'Não foi possível importar. Exporte sua cópia antes de sair.',
      )
      return false
    }
  }
  async function request(
    action: (client: ApiClient) => Promise<RemoteNotebook>,
  ) {
    if (pending.current || !api) return
    const requestId = generation.current
    pending.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await action(api)
      if (requestId !== generation.current) return
      setBase(result)
      setConflict(false)
    } catch (error) {
      if (requestId !== generation.current) return
      if (error instanceof ApiError && error.status === 409) setConflict(true)
      if (error instanceof ApiError && error.status === 401) onExpired()
      setMessage(apiErrorMessage(error))
    } finally {
      pending.current = false
      if (requestId === generation.current) setBusy(false)
    }
  }
  async function sync() {
    if (blocked || conflict) return
    const snapshot = notebook
    try {
      saveWorkspace({ version: 1, ownerId, base, snapshot })
    } catch {
      setStorageError(
        'Não foi possível preservar sua cópia local. Exporte antes de sincronizar.',
      )
      return
    }
    setStorageError('')
    await request((client) => client.save(base.id, base.revision, snapshot))
  }
  async function loadRemote() {
    const requestId = generation.current
    await request(async (client) => {
      const latest = await client.get(base.id)
      if (requestId !== generation.current) return latest
      saveWorkspace({
        version: 1,
        ownerId,
        base: latest,
        snapshot: latest.snapshot,
      })
      setNotebook(latest.snapshot)
      setBlocked(false)
      setStorageError('')
      return latest
    })
  }
  function rawCache() {
    try {
      return localStorage.getItem(workspaceKey(ownerId, base.id)) ?? ''
    } catch {
      setMessage('Não foi possível ler o cache. Exporte a cópia aberta.')
      return ''
    }
  }
  return {
    notebook,
    setNotebook: (value: SetStateAction<Notebook>) => setNotebook(value),
    replaceNotebook,
    storageError,
    dirty,
    conflict,
    blocked,
    busy,
    message,
    sync,
    loadRemote,
    rawCache,
  }
}
export type SyncController = ReturnType<typeof useAccountNotebook>
