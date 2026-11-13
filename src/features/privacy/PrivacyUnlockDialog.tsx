import { useState } from 'react'
import { Modal } from '../../components/Modal'
import type { PrivacyController } from './usePrivacy'
export function PrivacyUnlockDialog({
  privacy,
}: {
  privacy: PrivacyController
}) {
  const [password, setPassword] = useState('')
  return (
    <Modal
      title="Senha de privacidade"
      compact
      closeOnBackdrop={false}
      closeDisabled={privacy.busy}
      onClose={privacy.cancelPrompt}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault()
          void privacy.unlock(password)
          setPassword('')
        }}
      >
        <label className="field">
          Senha de privacidade
          <input
            autoFocus
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            value={password}
            disabled={privacy.busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="primary-button" disabled={privacy.busy}>
          {privacy.busy ? 'Abrindo…' : 'Acessar'}
        </button>
        {privacy.error && <p role="alert">{privacy.error}</p>}
        <p className="muted">Use a senha definida em Ajustes → Privacidade.</p>
      </form>
    </Modal>
  )
}
