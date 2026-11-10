import type { Section } from '../../types'
import { Icon } from '../../components/Icon'

export function SectionCard({
  section,
  count,
  onOpen,
  onEdit,
  onToggleFavorite,
}: {
  section: Section
  count: number
  onOpen: () => void
  onEdit: () => void
  onToggleFavorite: () => void
}) {
  return (
    <article className="section-card" style={{ borderTopColor: section.color }}>
      <button className="section-open" onClick={onOpen}>
        <span className="section-emoji" aria-hidden="true">
          {section.emoji || '📁'}
        </span>
        <h3>{section.title}</h3>
        {section.tags && section.tags.length > 0 && (
          <span
            className="section-tags"
            aria-label={`Tags: ${section.tags.join(', ')}`}
          >
            {section.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </span>
        )}
        <span className="muted">
          {count} {count === 1 ? 'item' : 'itens'}
        </span>
        <Icon name="chevron" />
      </button>
      <button
        className={
          section.favorite
            ? 'icon-button section-favorite is-favorite'
            : 'icon-button section-favorite'
        }
        aria-label={
          section.favorite
            ? `Remover ${section.title} dos favoritos`
            : `Fixar ${section.title} no topo`
        }
        aria-pressed={Boolean(section.favorite)}
        onClick={onToggleFavorite}
      >
        <Icon name="star" />
      </button>
      <button
        className="icon-button section-menu"
        aria-label={`Configurar ${section.title}`}
        onClick={onEdit}
      >
        <Icon name="more" />
      </button>
    </article>
  )
}
