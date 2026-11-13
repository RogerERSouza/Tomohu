import { useState } from 'react'
import { passwordHint, validNewPassword } from '../account/passwordPolicy'
import type { PrivacyController } from './usePrivacy'

export function PrivacyPanel({
  privacy,
  authenticated,
}: {
  privacy: PrivacyController
  authenticated: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [previous, setPrevious] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validation, setValidation] = useState('')
  return (
    <section className="privacy-panel" aria-label="Privacidade">
      <h3>Privacidade</h3>
      {privacy.hasDraft && (
        <p role="status">
          Há alterações privadas pendentes. Aguarde o salvamento ou exporte uma
          cópia antes de fechar esta aba.
        </p>
      )}
      {!authenticated ? (
        <p>
          Entre na conta e confirme seu e-mail para configurar uma senha de
          privacidade. O caderno local continua disponível.
        </p>
      ) : (
        <>
          <button
            className="secondary-button"
            onClick={() => {
              setExpanded(!expanded)
              if (!expanded) void privacy.status()
            }}
          >
            Configurar privacidade
          </button>
          {expanded && (
            <div className="modal-form">
              <p>
                Uma senha de privacidade para todas as suas seções e conteúdos
                privados. Ela pode ser igual ou diferente da senha da conta;
                alterar uma não altera a outra.
              </p>
              <p className="muted">
                Itens privados ficam na conta e exigem conexão. Backups e
                sincronização do caderno comum incluem apenas dados públicos.
                Exporte os dados privados pelo próprio item depois de
                desbloquear.
              </p>
              {privacy.configured !== null && (
                <form
                  className="modal-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setValidation('')
                    if (
                      !validNewPassword(password) ||
                      password !== confirmation
                    ) {
                      setValidation(
                        password !== confirmation
                          ? 'As senhas não coincidem.'
                          : passwordHint,
                      )
                      return
                    }
                    void privacy.password(password, previous)
                    setPassword('')
                    setPrevious('')
                    setConfirmation('')
                  }}
                >
                  <fieldset
                    disabled={privacy.busy}
                    className="modal-form account-controls"
                  >
                    {privacy.configured && (
                      <label className="field">
                        Senha de privacidade atual
                        <input
                          type="password"
                          required
                          autoComplete="current-password"
                          value={previous}
                          onChange={(e) => setPrevious(e.target.value)}
                        />
                      </label>
                    )}
                    <p className="muted">{passwordHint}</p>
                    <label className="field">
                      Nova senha de privacidade
                      <input
                        type="password"
                        required
                        minLength={5}
                        maxLength={128}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Confirmar senha de privacidade
                      <input
                        type="password"
                        required
                        minLength={5}
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                      />
                    </label>
                    <button className="primary-button">
                      Salvar senha de privacidade
                    </button>
                  </fieldset>
                </form>
              )}
              {validation && <p role="alert">{validation}</p>}
              {privacy.configured && (
                <button
                  className="text-button"
                  disabled={privacy.busy}
                  onClick={() => void privacy.reset()}
                >
                  Esqueci a senha de privacidade: enviar e-mail
                </button>
              )}
              <label className="field">
                Exibição dos itens privados
                <select
                  value={privacy.mode}
                  onChange={(e) =>
                    privacy.setMode(
                      e.target.value === 'area' ? 'area' : 'inline',
                    )
                  }
                >
                  <option value="inline">Manter no local original</option>
                  <option value="area">Área exclusiva de privados</option>
                </select>
              </label>
              {privacy.mode === 'area' && (
                <button className="secondary-button" onClick={privacy.openArea}>
                  Abrir itens privados
                </button>
              )}
              {privacy.unlocked && !privacy.opened && (
                <button className="text-button" onClick={privacy.lock}>
                  Bloquear privacidade agora
                </button>
              )}
            </div>
          )}
        </>
      )}
      {privacy.error && <p role="alert">{privacy.error}</p>}
      {privacy.notice && <p role="status">{privacy.notice}</p>}
    </section>
  )
}
