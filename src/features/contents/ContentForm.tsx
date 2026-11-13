import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { CONTENT_LABELS } from '../../lib/notebook'
import type { ContentKind } from '../../types'

export function ContentForm({
  onSave,
  privacyState,
}: {
  onSave: (kind: ContentKind, title: string, makePrivate?: boolean) => void
  privacyState?: 'public' | 'private' | 'inherited'
}) {
  const [makePrivate, setMakePrivate] = useState(
    privacyState === 'private' || privacyState === 'inherited',
  )
  const [title, setTitle] = useState('')
  const [hasTriedToSave, setHasTriedToSave] = useState(false)
  const [kind, setKind] = useState<ContentKind>('note')
  return (
    <form
      className="modal-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setHasTriedToSave(true)
        if (!title.trim()) return
        onSave(kind, title.trim(), makePrivate)
      }}
    >
      <label className="field">
        <span>Título</span>
        <input
          required
          maxLength={100}
          placeholder="O que você quer registrar?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {hasTriedToSave && !title.trim() && (
          <small className="form-warning" role="alert">
            Não é possível criar o conteúdo. Escreva o título.
          </small>
        )}
      </label>
      <fieldset className="type-field">
        <legend>Tipo de conteúdo</legend>
        <div className="type-options">
          {(Object.keys(CONTENT_LABELS) as ContentKind[]).map((option) => (
            <label
              className={
                kind === option ? 'type-option selected' : 'type-option'
              }
              key={option}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              <Icon name={option} />
              {CONTENT_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
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
      <button className="primary-button" type="submit">
        Criar e abrir
      </button>
    </form>
  )
}
