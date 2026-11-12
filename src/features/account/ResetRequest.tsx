import { useState } from 'react'

export function ResetRequest({
  busy,
  onSubmit,
  onBack,
}: {
  busy: boolean
  onSubmit: (email: string) => Promise<void>
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (sending || busy) return
        setSending(true)
        void onSubmit(email)
          .then(() => setSent(true))
          .catch(() => setSent(false))
          .finally(() => setSending(false))
      }}
    >
      <h4>Recuperar senha</h4>
      <p className="muted">
        Enviaremos um link de uso único, válido por 30 minutos, se o endereço
        tiver uma conta ativa.
      </p>
      <label className="field">
        E-mail para recuperação
        <input
          required
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          disabled={busy || sending}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button className="primary-button" disabled={busy || sending}>
        Enviar link de recuperação
      </button>
      {sent && (
        <p role="status">
          Solicitação recebida. Confira o e-mail e a pasta de spam. Se o link
          não chegar, aguarde um minuto antes de tentar novamente.
        </p>
      )}
      <button
        type="button"
        className="text-button"
        disabled={busy || sending}
        onClick={onBack}
      >
        Voltar ao login
      </button>
    </form>
  )
}
