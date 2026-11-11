import { useState } from 'react'

export function CredentialsForm({
  busy,
  canSwitch,
  expired,
  onAuthenticate,
}: {
  busy: boolean
  canSwitch: boolean
  expired: boolean
  onAuthenticate: (
    email: string,
    password: string,
    register: boolean,
  ) => Promise<void>
}) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
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
          minLength={15}
          maxLength={128}
          value={password}
          disabled={busy || !canSwitch}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p className="muted">
        Use entre 15 e 128 caracteres. A sessão precisa ser renovada após
        expirar ou recarregar a página.
      </p>
      {register && (
        <p className="muted">
          Guarde sua senha: a recuperação de senha ainda não está disponível.
        </p>
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
