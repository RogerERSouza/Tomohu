import { Icon } from '../../components/Icon'

export function ImportBackupPanel({
  fileName,
  onExport,
  onBack,
  onReplace,
}: {
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
      <div className="import-backup-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="primary-button" onClick={onReplace}>
          Substituir dados
        </button>
      </div>
    </div>
  )
}
