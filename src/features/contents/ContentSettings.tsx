import { useState } from 'react'
import type { Content } from '../../types'
export function ContentSettings({
  content,
  privacyState,
  onSave,
}: {
  content: Content
  privacyState?: 'public' | 'private' | 'inherited'
  onSave: (title: string, makePrivate: boolean) => void
}) {
  const [title, setTitle] = useState(content.title)
  const [makePrivate, setMakePrivate] = useState(
    privacyState === 'private' || privacyState === 'inherited',
  )
  return (
    <form
      className="modal-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(title.trim(), makePrivate)
      }}
    >
      <label className="field">
        Título
        <input
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {privacyState && (
        <label className="privacy-option">
          <input
            type="checkbox"
            checked={makePrivate}
            disabled={privacyState === 'inherited'}
            onChange={(e) => setMakePrivate(e.target.checked)}
          />
          Conteúdo privado
          {privacyState === 'inherited' && (
            <small>Protegido pela seção principal.</small>
          )}
        </label>
      )}
      <button className="primary-button">Salvar alterações</button>
    </form>
  )
}
