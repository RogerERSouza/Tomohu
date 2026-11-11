import { Icon } from '../../components/Icon'

export function ImportBackupPanel({
  fileName,
  blocked = false,
  error = '',
  onExport,
  onBack,
  onReplace,
}: {
  blocked?: boolean
  error?: string
  fileName: string
  onExport: () => void
  onBack: () => void
  onReplace: () => void
}) {
  return (
    <div className="import-backup-panel">
      <p>
        O backup <strong>{fileName}</strong> está válido. Ao continuar, ele
        substituirá os dados atuais deste navegador.
      </p>
      <p className="muted">
        Exporte uma cópia atual antes de continuar, caso queira voltar atrás
        depois.
      </p>
      <button className="secondary-button" onClick={onExport}>
        <Icon name="download" />
        Exportar cópia atual
      </button>
      {blocked && (
        <p role="status">
          Aguarde a operação da conta terminar antes de importar.
        </p>
      )}
      {error && (
        <p className="form-warning" role="alert">
          {error}
        </p>
      )}
      <div className="import-backup-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          Voltar
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onReplace}
          disabled={blocked}
        >
          Substituir dados
        </button>
      </div>
    </div>
  )
}
