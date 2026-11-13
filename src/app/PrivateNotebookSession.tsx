import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Notebook } from '../types'
import { createNotebookActions } from '../features/notebook/createNotebookActions'
import { usePrivateAutosave } from '../features/privacy/usePrivateAutosave'
import {
  privateView,
  privateEdit,
  ownsPrivateRoute,
} from '../features/privacy/privateNotebook'
import type { PrivacyController } from '../features/privacy/usePrivacy'
import type {
  PrivateDocument,
  ItemPrivacyControls,
} from '../features/privacy/privacyTypes'
import { useExportCheckpoint } from '../features/backup/useExportCheckpoint'
import { privateCells } from '../features/privacy/PrivateCards'
import { NotebookView } from './NotebookView'

const subscribe = (change: () => void) => {
  window.addEventListener('hashchange', change)
  return () => window.removeEventListener('hashchange', change)
}
const getHash = () => window.location.hash
export function PrivateNotebookSession({
  privacy,
  document,
  publicBook,
  accountPanel,
}: {
  privacy: PrivacyController
  document: PrivateDocument
  publicBook: Notebook
  accountPanel: React.ReactNode
}) {
  const { registerFlush } = privacy
  const autosave = usePrivateAutosave(
    document,
    privacy.read,
    privacy.write,
    privacy.persist,
  )
  const backup = useExportCheckpoint(document.snapshot)
  const view = privateView(publicBook, document.snapshot, document.item)
  const hash = useSyncExternalStore(subscribe, getHash)
  const last = useRef(hash)
  const exiting = useRef(false)
  useEffect(
    () => registerFlush(autosave.flush),
    [registerFlush, autosave.flush],
  )
  useEffect(() => {
    if (ownsPrivateRoute(hash, document.snapshot, document.item)) {
      last.current = hash
      return
    }
    if (exiting.current) return
    exiting.current = true
    void privacy
      .close(hash)
      .then((ok) => {
        if (!ok) window.location.hash = last.current
      })
      .finally(() => {
        exiting.current = false
      })
  }, [hash, document.snapshot, document.item, privacy])
  const setNotebook: Dispatch<SetStateAction<Notebook>> = (change) => {
    const current = privacy.read()
    if (!current) return
    const currentView = privateView(publicBook, current.snapshot, current.item)
    const next = typeof change === 'function' ? change(currentView) : change
    const updated = privateEdit(current.snapshot, next, current.item)
    const rootPresent =
      current.item.kind === 'section'
        ? updated.sections.some((s) => s.id === current.item.root_id)
        : updated.contents.some((c) => c.id === current.item.root_id)
    if (!rootPresent) {
      void privacy.remove()
      return
    }
    privacy.write({ ...current, snapshot: updated, dirty: true })
  }
  const actions = createNotebookActions(setNotebook)
  const state: ItemPrivacyControls['state'] = (kind, id) =>
    kind === document.item.kind && id === document.item.root_id
      ? 'private'
      : 'inherited'
  const controls: ItemPrivacyControls = {
    state,
    error: privacy.error || autosave.error,
    section: (existing, parent, values, makePrivate) => {
      actions.saveSection(existing, parent, values)
      if (
        existing &&
        state('section', existing.id) === 'private' &&
        !makePrivate
      )
        void privacy.restore()
    },
    content: (existing, parent, kind, title, makePrivate) => {
      if (existing) {
        actions.updateContent({ ...existing, title })
        if (state('content', existing.id) === 'private' && !makePrivate)
          void privacy.restore()
      } else return actions.addContent(kind, parent, title).id
    },
  }
  const beforeSectionNavigate = (id?: string) => {
    const target = id ? `#section/${id}` : ''
    if (ownsPrivateRoute(target, document.snapshot, document.item)) return true
    void privacy.close(target)
    return false
  }
  const section = view.sections.find((s) => s.id === document.item.root_id)
  const content = view.contents.find((c) => c.id === document.item.root_id)
  if (!ownsPrivateRoute(hash, document.snapshot, document.item))
    return (
      <p className="workspace-status" role="status">
        Voltando ao caderno…
      </p>
    )
  return (
    <NotebookView
      controller={{
        notebook: view,
        setNotebook,
        replaceNotebook: () => false,
        storageError: '',
      }}
      privacy={controls}
      initialEditor={
        document.configure
          ? document.item.kind === 'section' && section
            ? { kind: 'section', section }
            : content
              ? { kind: 'content-settings', content }
              : null
          : null
      }
      beforeSectionNavigate={beforeSectionNavigate}
      privateCells={(parentId) =>
        privateCells(privacy, parentId).filter(
          (cell) => cell.id !== document.item.id,
        )
      }
      interactionBlocked={privacy.busy}
      onExport={backup.exportNotebook}
      status={
        <div className="private-status">
          <p role="status">
            🔒{' '}
            {autosave.saving
              ? 'Salvando item privado…'
              : document.dirty
                ? 'Alterações privadas pendentes'
                : 'Item privado salvo na conta'}
          </p>
          {(autosave.error || privacy.error) && (
            <div role="alert">
              {autosave.error || privacy.error}
              <button
                className="text-button"
                onClick={() => void autosave.flush()}
              >
                Tentar salvar novamente
              </button>
              <button className="text-button" onClick={backup.exportNotebook}>
                Exportar rascunho
              </button>
              <button
                className="text-button"
                disabled={
                  autosave.saving || (document.dirty && !backup.hasExported)
                }
                onClick={() => void privacy.reload()}
              >
                Recarregar item da conta
              </button>
              <button
                className="text-button"
                disabled={!backup.hasExported}
                onClick={() => {
                  if (
                    window.confirm(
                      'Voltar ao caderno sem salvar este rascunho? A cópia exportada será mantida.',
                    )
                  )
                    void privacy.close('', true)
                }}
              >
                Voltar sem salvar
              </button>
            </div>
          )}
        </div>
      }
      accountPanel={
        <>
          <p>
            Este item é privado e salva automaticamente na conta. A exportação
            contém somente este item, em JSON legível.
          </p>
          {accountPanel}
        </>
      }
    />
  )
}
