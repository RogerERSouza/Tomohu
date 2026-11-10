import { useState } from 'react'
import type { Content, ListItem } from '../../types'
import { getCounterTotal } from '../../lib/notebook'
import { formatDateTime, type HourFormat } from '../../lib/time'
import { Icon } from '../../components/Icon'
import { ListProgress } from './ListProgress'

export function ContentEditor({
  content,
  onChange,
  onCount,
  onRemove,
  hourFormat,
}: {
  content: Content
  onChange: (content: Content) => void
  onCount: (delta: number) => void
  onRemove: () => void
  hourFormat: HourFormat
}) {
  const [newItem, setNewItem] = useState('')
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false)
  function updateItems(items: ListItem[]) {
    if (content.kind === 'checklist' || content.kind === 'tutorial')
      onChange({ ...content, items })
  }
  function moveItem(index: number, offset: number) {
    if (content.kind !== 'checklist' && content.kind !== 'tutorial') return
    const items = [...content.items]
    const target = index + offset
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    updateItems(items)
  }
  return (
    <div className="editor-panel">
      <label className="field">
        <span>Título</span>
        <input
          value={content.title}
          maxLength={100}
          onChange={(event) =>
            onChange({ ...content, title: event.target.value })
          }
          onBlur={() => {
            if (!content.title.trim())
              onChange({ ...content, title: 'Sem título' })
          }}
        />
      </label>
      {(content.kind === 'note' || content.kind === 'tutorial') && (
        <label className="field">
          <span>
            {content.kind === 'note'
              ? 'Sua nota'
              : 'Introdução ou tutorial em texto livre'}
          </span>
          <textarea
            className={content.kind === 'note' ? 'note-editor' : ''}
            placeholder="Escreva suas ideias aqui…"
            value={content.text}
            onChange={(event) =>
              onChange({ ...content, text: event.target.value })
            }
          />
        </label>
      )}
      {(content.kind === 'checklist' || content.kind === 'tutorial') && (
        <section
          className="list-editor"
          aria-label={
            content.kind === 'tutorial'
              ? 'Passos do tutorial'
              : 'Itens da lista'
          }
        >
          <div className="subheading">
            <h2>{content.kind === 'tutorial' ? 'Passos' : 'Itens da lista'}</h2>
          </div>
          <ListProgress items={content.items} />
          {content.items.length === 0 && (
            <p className="muted">
              Adicione o primeiro{' '}
              {content.kind === 'tutorial' ? 'passo' : 'item'} abaixo.
            </p>
          )}
          {content.items.map((item, index) => (
            <div className="editable-item" key={item.id}>
              <input
                type="checkbox"
                aria-label={`Concluir ${item.text}`}
                checked={item.completed}
                onChange={() =>
                  updateItems(
                    content.items.map((current) =>
                      current.id === item.id
                        ? { ...current, completed: !current.completed }
                        : current,
                    ),
                  )
                }
              />
              {content.kind === 'tutorial' && (
                <span className="step-number">{index + 1}.</span>
              )}
              <input
                className={item.completed ? 'item-text completed' : 'item-text'}
                aria-label={`${content.kind === 'tutorial' ? 'Passo' : 'Item'} ${index + 1}`}
                value={item.text}
                onChange={(event) =>
                  updateItems(
                    content.items.map((current) =>
                      current.id === item.id
                        ? { ...current, text: event.target.value }
                        : current,
                    ),
                  )
                }
              />
              <div className="item-actions">
                <button
                  className="icon-button small"
                  aria-label={`Mover item ${index + 1} para cima`}
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                >
                  <Icon name="arrow-up" />
                </button>
                <button
                  className="icon-button small"
                  aria-label={`Mover item ${index + 1} para baixo`}
                  disabled={index === content.items.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  <Icon name="arrow-down" />
                </button>
                <button
                  className="icon-button small"
                  aria-label={`Excluir item ${index + 1}`}
                  onClick={() =>
                    updateItems(
                      content.items.filter((current) => current.id !== item.id),
                    )
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
          ))}
          <form
            className="add-item"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newItem.trim()) return
              updateItems([
                ...content.items,
                {
                  id: crypto.randomUUID(),
                  text: newItem.trim(),
                  completed: false,
                },
              ])
              setNewItem('')
            }}
          >
            <input
              aria-label="Novo item"
              placeholder={
                content.kind === 'tutorial'
                  ? 'Escreva um novo passo…'
                  : 'Adicionar um item…'
              }
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              maxLength={500}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={!newItem.trim()}
            >
              <Icon name="plus" />
              Adicionar
            </button>
          </form>
        </section>
      )}
      {content.kind === 'counter' && (
        <>
          <div className="counter-detail">
            <span className="eyebrow">TOTAL REGISTRADO</span>
            <div className="counter-controls">
              <button
                className="icon-button"
                aria-label="Diminuir contagem"
                disabled={getCounterTotal(content.entries) === 0}
                onClick={() => onCount(-1)}
              >
                −
              </button>
              <output aria-live="polite">
                {getCounterTotal(content.entries)}
              </output>
              <button
                className="icon-button"
                aria-label="Aumentar contagem"
                onClick={() => onCount(1)}
              >
                +
              </button>
            </div>
            <p className="muted">
              Cada alteração registra a data. A anotação é opcional.
            </p>
          </div>
          <div className="subheading">
            <h2>Histórico</h2>
            <span className="muted">{content.entries.length} registros</span>
          </div>
          {content.entries.length === 0 && (
            <p className="empty-history">
              Seu primeiro registro aparecerá aqui.
            </p>
          )}
          <div className="history-list">
            {[...content.entries].reverse().map((entry) => (
              <article className="history-entry" key={entry.id}>
                <span
                  className={
                    entry.delta > 0 ? 'history-delta positive' : 'history-delta'
                  }
                >
                  {entry.delta > 0 ? '+' : ''}
                  {entry.delta}
                </span>
                <div>
                  <time dateTime={entry.createdAt}>
                    {formatDateTime(new Date(entry.createdAt), hourFormat)}
                  </time>
                  <input
                    aria-label={`Anotação do registro de ${formatDateTime(new Date(entry.createdAt), hourFormat)}`}
                    placeholder="Adicionar uma anotação…"
                    value={entry.note}
                    onChange={(event) =>
                      onChange({
                        ...content,
                        entries: content.entries.map((current) =>
                          current.id === entry.id
                            ? { ...current, note: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="content-delete">
        {isDeleteConfirmationVisible ? (
          <>
            <p className="form-warning" role="alert">
              Este conteúdo será apagado permanentemente.
            </p>
            <div className="content-delete-actions">
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
                Excluir conteúdo
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
            Excluir conteúdo
          </button>
        )}
      </div>
    </div>
  )
}
