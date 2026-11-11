import { downloadJson } from '../../lib/browserFiles'
import { parseNotebookBackup } from '../../lib/notebook'
import { downloadNotebook } from '../backup/backupFiles'
import { useState } from 'react'
import type { SyncController } from './useAccountNotebook'

export function SyncPanel({
  sync,
  authenticated,
  onExport,
}: {
  sync: SyncController
  authenticated: boolean
  onExport: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  function exportCache() {
    const raw = sync.rawCache()
    if (!raw) return
    try {
      downloadNotebook(parseNotebookBackup(raw))
    } catch {
      downloadJson(raw, 'tomohu-damaged-account-cache.json')
    }
  }
  return (
    <section aria-label="Sincronização" className="account-panel">
      <h3>Sincronização</h3>
      <p role="status">
        {sync.busy
          ? 'Sincronizando…'
          : sync.conflict
            ? 'Conflito: há outra versão na conta.'
            : sync.dirty
              ? 'Alterações locais pendentes de envio.'
              : 'Cópia local igual à última versão carregada ou enviada.'}
      </p>
      <p className="muted">
        Editar salva neste navegador. Use o botão para enviar à conta; outro
        dispositivo pode ter alterações mais recentes.
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={
          !authenticated ||
          sync.busy ||
          sync.blocked ||
          sync.conflict ||
          !sync.dirty
        }
        onClick={() => void sync.sync()}
      >
        Sincronizar agora
      </button>
      <button type="button" className="secondary-button" onClick={onExport}>
        Exportar cópia aberta
      </button>
      {sync.blocked && (
        <button
          type="button"
          className="secondary-button"
          onClick={exportCache}
        >
          Exportar cache preservado
        </button>
      )}
      {(sync.dirty || sync.blocked) && (
        <label className="account-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={sync.busy}
          />
          Já exportei o que preciso e confirmo substituir a cópia aberta pela
          versão da conta.
        </label>
      )}
      <button
        type="button"
        className="secondary-button"
        disabled={
          ((sync.dirty || sync.blocked) && !confirmed) ||
          !authenticated ||
          sync.busy
        }
        onClick={() => {
          setConfirmed(false)
          void sync.loadRemote()
        }}
      >
        Carregar versão da conta
      </button>
      {sync.message && (
        <p role="alert" className="form-warning">
          {sync.message}
        </p>
      )}
    </section>
  )
}
