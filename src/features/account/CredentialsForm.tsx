import { useState } from 'react'
import { passwordHint, validNewPassword } from './passwordPolicy'
import { ResetRequest } from './ResetRequest'

export function CredentialsForm({
  busy,
  canSwitch,
  expired,
  onAuthenticate,
  onRequestReset,
}: {
  busy: boolean
  canSwitch: boolean
  expired: boolean
  onRequestReset: (email: string) => Promise<void>
  onAuthenticate: (
    email: string,
    password: string,
    register: boolean,
  ) => Promise<void>
}) {
  const [recover, setRecover] = useState(false)
  const [validation, setValidation] = useState('')
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  if (recover)
    return (
      <ResetRequest
        busy={busy}
        onSubmit={onRequestReset}
        onBack={() => setRecover(false)}
      />
    )
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (register && !validNewPassword(password)) {
          setValidation(passwordHint)
          return
        }
        setValidation('')
        const secret = password
        setPassword('')
        void onAuthenticate(email, secret, register)
      }}
    >
      {expired && (
        <p role="status">
          Sua sessão expirou. Entre novamente para sincronizar. A cópia local
          desta conta foi preservada.
        </p>
      )}
      <label className="field">
        E-mail
        <input
          required
          type="email"
          autoComplete="username"
          maxLength={254}
          value={email}
          disabled={busy || !canSwitch}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="field">
        Senha
        <input
          required
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          minLength={register ? 5 : 1}
          maxLength={128}
          value={password}
          disabled={busy || !canSwitch}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p className="muted">
        {register
          ? passwordHint
          : 'A sessão precisa ser renovada após expirar ou recarregar a página.'}
      </p>
      {validation && <p role="alert">{validation}</p>}
      {!register && (
        <button
          type="button"
          className="text-button"
          disabled={busy || !canSwitch}
          onClick={() => setRecover(true)}
        >
          Esqueci minha senha
        </button>
      )}
      <button className="primary-button" disabled={busy || !canSwitch}>
        {busy ? 'Aguarde…' : register ? 'Criar conta e entrar' : 'Entrar'}
      </button>
      <button
        type="button"
        className="text-button"
        disabled={busy || !canSwitch}
        onClick={() => setRegister((value) => !value)}
      >
        {register ? 'Já tenho conta' : 'Quero criar uma conta'}
      </button>
    </form>
  )
}
