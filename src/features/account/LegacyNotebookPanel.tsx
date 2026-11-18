import { useState } from 'react'
import { parseNotebookBackup, STORAGE_KEY } from '../../lib/notebook'
import { downloadJson } from '../../lib/browserFiles'
import type { Notebook } from '../../types'

export function LegacyNotebookPanel({
  onCopy,
  busy = false,
}: {
  onCopy?: (snapshot: Notebook) => Promise<void>
  busy?: boolean
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [state, setState] = useState(() => {
    try {
      return { raw: localStorage.getItem(STORAGE_KEY), error: '' }
    } catch {
      return {
        raw: null,
        error:
          'Não foi possível ler os dados antigos deste navegador. Eles não foram alterados.',
      }
    }
  })
  function currentRaw(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      setState({
        raw: state.raw,
        error:
          'Não foi possível ler os dados anteriores. Tente novamente antes de copiar.',
      })
      return null
    }
  }
  if (state.error) return <p role="alert">{state.error}</p>
  if (!state.raw) return null
  let parsed: Notebook | null = null
  try {
    parsed = parseNotebookBackup(state.raw)
  } catch {
    /* Preserve the original bytes for export/repair. */
  }
  const snapshot = parsed
  return (
    <section className="modal-form" aria-label="Dados anteriores">
      <h3>Dados anteriores deste navegador</h3>
      <p>
        O caderno antigo foi preservado. Exporte uma cópia ou, após entrar,
        copie para um novo caderno da conta.
      </p>
      <button
        className="secondary-button"
        onClick={() => {
          const raw = currentRaw()
          if (raw !== null) downloadJson(raw, 'tomohu-local-preserved.json')
        }}
      >
        Exportar dados anteriores
      </button>
      {!snapshot && (
        <p role="alert">
          Os dados antigos precisam de revisão. Exporte o original; nenhuma
          substituição foi feita.
        </p>
      )}
      {onCopy && snapshot && (
        <>
          <label className="account-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Confirmo copiar os dados anteriores para esta conta, mantendo o
            original.
          </label>
          <button
            className="secondary-button"
            disabled={!confirmed || busy}
            onClick={() => {
              setConfirmed(false)
              const raw = currentRaw()
              if (raw !== state.raw) {
                setState({ raw, error: '' })
                return
              }
              void onCopy(snapshot)
            }}
          >
            Copiar dados anteriores para a conta
          </button>
        </>
      )}
    </section>
  )
}
