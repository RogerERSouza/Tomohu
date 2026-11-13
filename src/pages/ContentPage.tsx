import { Icon } from '../components/Icon'
import { ContentEditor } from '../features/contents/ContentEditor'
import { CONTENT_LABELS } from '../lib/notebook'
import type { Content } from '../types'
import type { HourFormat } from '../lib/time'
import type { NotebookActions } from '../features/notebook/createNotebookActions'

export function ContentPage({
  content,
  actions,
  hourFormat,
  openSection,
  onConfigure,
}: {
  onConfigure?: () => void
  content: Content
  actions: NotebookActions
  hourFormat: HourFormat
  openSection: (id?: string) => void
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{CONTENT_LABELS[content.kind]}</span>
          <h1>{content.title || 'Sem título'}</h1>
        </div>
        {onConfigure && (
          <button
            className="icon-button"
            aria-label={`Configurar ${content.title || 'conteúdo'}`}
            onClick={onConfigure}
          >
            <Icon name="more" />
          </button>
        )}
        <button
          className="secondary-button"
          onClick={() => openSection(content.sectionId)}
        >
          <Icon name="back" />
          Voltar à seção
        </button>
      </div>
      <ContentEditor
        key={content.id}
        content={content}
        onChange={actions.updateContent}
        onCount={(delta) => actions.changeCount(content.id, delta)}
        onRemove={() => {
          actions.deleteContent(content.id)
          openSection(content.sectionId)
        }}
        hourFormat={hourFormat}
      />
    </>
  )
}
