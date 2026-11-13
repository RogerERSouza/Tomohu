import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { WorkspaceCache } from './workspaceStorage'

export function useAccountNotebook(
  ownerId: string,
  remote: RemoteNotebook,
  api: ApiClient | null,
  onExpired: () => void,
) {
  const [initial] = useState(() => loadWorkspace(ownerId, remote))
  const [notebook, updateNotebook] = useState(initial.cache.snapshot)
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
  const paused = useRef(initial.blocked)
  const stored = useRef(initial.raw)
  const edits = useRef(0)
  const externalChanges = useRef(0)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  const dirty = !sameNotebook(notebook, base.snapshot)
  const pauseForExternalChange = useCallback(() => {
    externalChanges.current++
    paused.current = true
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
  }, [ownerId, base, notebook])
  const persist = useCallback(
    (cache: WorkspaceCache, expected = stored.current) => {
      if (localStorage.getItem(workspaceKey(ownerId, base.id)) !== expected) {
        pauseForExternalChange()
        return false
      }
      saveWorkspace(cache)
      stored.current = JSON.stringify(cache)
      return true
    },
    [ownerId, base.id, pauseForExternalChange],
  )
  useEffect(() => {
    if (paused.current) return
    let active = true
    try {
      persist({ version: 1, ownerId, base, snapshot: notebook })
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
  }, [base, notebook, ownerId, blocked, persist])
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (
        (event.storageArea && event.storageArea !== localStorage) ||
        (event.key !== null && event.key !== workspaceKey(ownerId, base.id))
      )
        return
      pauseForExternalChange()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [ownerId, base.id, pauseForExternalChange])
  function setNotebook(value: SetStateAction<Notebook>) {
    edits.current++
    updateNotebook(value)
  }
  function replaceNotebook(snapshot: Notebook) {
    if (pending.current) {
      setMessage('Aguarde a operação da conta terminar antes de importar.')
      return false
    }
    if (paused.current) {
      setMessage(
        'Exporte o cache preservado e recupere a versão da conta antes de importar.',
      )
      return false
    }
    try {
      if (!persist({ version: 1, ownerId, base, snapshot })) return false
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
    action: (client: ApiClient) => Promise<RemoteNotebook | null>,
  ) {
    if (pending.current || !api) return
    const requestId = generation.current
    pending.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await action(api)
      if (requestId !== generation.current || !result) return
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
    if (pending.current || paused.current || conflict) return
    const snapshot = notebook
    try {
      if (!persist({ version: 1, ownerId, base, snapshot })) return
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
    if (pending.current || !api) return
    let expected: string | null
    try {
      expected = localStorage.getItem(workspaceKey(ownerId, base.id))
    } catch {
      setStorageError(
        'Não foi possível ler o cache. Exporte antes de recuperar.',
      )
      return
    }
    if (!paused.current && expected !== stored.current) {
      pauseForExternalChange()
      return
    }
    const requestId = generation.current
    const editVersion = edits.current
    const externalVersion = externalChanges.current
    await request(async (client) => {
      const latest = await client.get(base.id)
      if (requestId !== generation.current) return null
      if (
        editVersion !== edits.current ||
        externalVersion !== externalChanges.current
      ) {
        setMessage(
          'A cópia local mudou durante o carregamento. Nada foi substituído; revise e confirme novamente.',
        )
        return null
      }
      if (
        !persist(
          { version: 1, ownerId, base: latest, snapshot: latest.snapshot },
          expected,
        )
      )
        return null
      updateNotebook(latest.snapshot)
      paused.current = false
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
    revision: base.revision,
    setNotebook,
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
