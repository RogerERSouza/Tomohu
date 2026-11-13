import { Modal } from '../../components/Modal'
import type { PrivacyController } from './usePrivacy'
export function PrivacyDialog({ privacy }: { privacy: PrivacyController }) {
  return (
    <Modal
      title="Itens privados"
      closeOnBackdrop={false}
      closeDisabled={privacy.busy}
      onClose={privacy.closeArea}
    >
      <div className="modal-form">
        {privacy.items.map((item, index) => (
          <button
            className="secondary-button"
            key={item.id}
            disabled={privacy.busy}
            onClick={() => privacy.openFromArea(item.id)}
          >
            🔒{' '}
            {item.title ||
              `${item.kind === 'section' ? 'Seção' : 'Conteúdo'} privado ${index + 1}`}
          </button>
        ))}
        {!privacy.items.length && <p>Nenhum item privado neste caderno.</p>}
        {privacy.error && <p role="alert">{privacy.error}</p>}
      </div>
    </Modal>
  )
}
