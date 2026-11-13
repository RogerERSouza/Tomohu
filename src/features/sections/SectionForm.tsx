import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { SECTION_COLORS } from '../../lib/notebook'
import type { Section } from '../../types'

export function SectionForm({
  section,
  onSave,
  onRemove,
  privacyState,
}: {
  section?: Section
  onSave: (
    values: Pick<Section, 'title' | 'emoji' | 'color' | 'tags'>,
    makePrivate?: boolean,
  ) => void
  onRemove?: () => void
  privacyState?: 'public' | 'private' | 'inherited'
}) {
  const [makePrivate, setMakePrivate] = useState(
    privacyState === 'private' || privacyState === 'inherited',
  )
  const [title, setTitle] = useState(section?.title ?? '')
  const [hasTriedToSave, setHasTriedToSave] = useState(false)
  const [emoji, setEmoji] = useState(section?.emoji ?? '📁')
  const [color, setColor] = useState(section?.color ?? SECTION_COLORS[0])
  const [tags, setTags] = useState(section?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false)
  return (
    <form
      className="modal-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setHasTriedToSave(true)
        if (!title.trim()) return
        onSave(
          { title: title.trim(), emoji: emoji.trim(), color, tags },
          makePrivate,
        )
      }}
    >
      <label className="field">
        <span>Nome da seção</span>
        <input
          required
          maxLength={80}
          placeholder="Ex.: Coisas para aprender"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {hasTriedToSave && !title.trim() && (
          <small className="form-warning" role="alert">
            Não é possível salvar a seção. Escreva o nome da seção.
          </small>
        )}
      </label>
      <label className="field">
        <span>
          Emoji <small>(opcional)</small>
        </span>
        <input
          maxLength={12}
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
        />
      </label>
      <fieldset className="color-field">
        <legend>Cor de destaque</legend>
        <div
          className="color-options"
          role="radiogroup"
          aria-label="Cores sugeridas"
        >
          {SECTION_COLORS.map((option, index) => (
            <label
              key={option}
              className="color-option"
              style={{ background: option }}
            >
              <input
                type="radio"
                name="color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                aria-label={
                  ['Azul', 'Lilás', 'Verde', 'Amarelo', 'Rosa'][index]
                }
              />
              <span aria-hidden="true">{color === option ? '✓' : ''}</span>
            </label>
          ))}
          <label className="color-picker" title="Escolher outra cor">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Escolher outra cor"
            />
            <span aria-hidden="true">+</span>
          </label>
        </div>
        <span className="color-value" aria-live="polite">
          Cor atual: {color.toUpperCase()}
        </span>
      </fieldset>
      <fieldset className="tag-field">
        <legend>
          Tags <small>(opcional)</small>
        </legend>
        <div className="tag-input-row">
          <input
            maxLength={24}
            placeholder="Ex.: escola"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              const tag = tagInput
                .trim()
                .replace(/^#/, '')
                .toLocaleLowerCase('pt-BR')
              if (tag && !tags.includes(tag))
                setTags((current) => [...current, tag])
              setTagInput('')
            }}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const tag = tagInput
                .trim()
                .replace(/^#/, '')
                .toLocaleLowerCase('pt-BR')
              if (tag && !tags.includes(tag))
                setTags((current) => [...current, tag])
              setTagInput('')
            }}
          >
            Adicionar
          </button>
        </div>
        {tags.length > 0 && (
          <div className="tag-list" aria-label="Tags da seção">
            {tags.map((tag) => (
              <button
                type="button"
                className="tag-chip"
                key={tag}
                onClick={() =>
                  setTags((current) => current.filter((item) => item !== tag))
                }
                aria-label={`Remover tag ${tag}`}
              >
                #{tag} ×
              </button>
            ))}
          </div>
        )}
      </fieldset>
      {privacyState && (
        <label className="privacy-option">
          <input
            type="checkbox"
            checked={makePrivate}
            disabled={privacyState === 'inherited'}
            onChange={(e) => setMakePrivate(e.target.checked)}
          />
          Seção privada
          {privacyState === 'inherited' && (
            <small>Protegida pela seção principal.</small>
          )}
        </label>
      )}
      <button className="primary-button" type="submit">
        {section ? 'Salvar alterações' : 'Criar seção'}
      </button>
      {section && onRemove && (
        <div className="section-delete">
          {isDeleteConfirmationVisible ? (
            <>
              <p className="form-warning" role="alert">
                Esta seção, suas subseções e todos os conteúdos internos serão
                apagados permanentemente.
              </p>
              <div className="section-delete-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsDeleteConfirmationVisible(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={onRemove}
                >
                  <Icon name="trash" />
                  Excluir seção
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setIsDeleteConfirmationVisible(true)}
            >
              <Icon name="trash" />
              Excluir seção
            </button>
          )}
        </div>
      )}
    </form>
  )
}
