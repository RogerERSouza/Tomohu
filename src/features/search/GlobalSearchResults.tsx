import { CONTENT_LABELS } from '../../lib/notebook'
import type { SearchResult } from '../../lib/search'
import { Icon } from '../../components/Icon'

const GROUPS = [
  { kind: 'section' as const, label: 'Seções' },
  { kind: 'content' as const, label: 'Conteúdos' },
  { kind: 'reminder' as const, label: 'Lembretes' },
]

export function GlobalSearchResults({
  results,
  onOpenSection,
  onOpenContent,
  onOpenReminder,
}: {
  results: SearchResult[]
  onOpenSection: (id: string) => void
  onOpenContent: (id: string) => void
  onOpenReminder: (id: string) => void
}) {
  if (results.length === 0)
    return (
      <div className="empty-state global-search-empty" aria-live="polite">
        <Icon name="search" />
        <h3>Nenhum resultado encontrado</h3>
        <p>Tente buscar por outro nome, texto ou item de lista.</p>
      </div>
    )

  return (
    <div className="global-search-results" aria-live="polite">
      {GROUPS.map((group) => {
        const groupResults = results.filter(
          (result) => result.kind === group.kind,
        )
        if (groupResults.length === 0) return null
        return (
          <section className="search-result-group" key={group.kind}>
            <h3>{group.label}</h3>
            <div className="search-result-list">
              {groupResults.map((result) => {
                const onClick =
                  result.kind === 'section'
                    ? () => onOpenSection(result.id)
                    : result.kind === 'content'
                      ? () => onOpenContent(result.id)
                      : () => onOpenReminder(result.id)
                const label =
                  result.kind === 'content'
                    ? CONTENT_LABELS[result.contentKind]
                    : result.kind === 'section'
                      ? 'Seção'
                      : 'Lembrete'
                const icon =
                  result.kind === 'content' ? result.contentKind : 'note'
                return (
                  <button
                    type="button"
                    className="search-result"
                    key={`${result.kind}-${result.id}`}
                    onClick={onClick}
                  >
                    <span className={`search-result-icon ${result.kind}`}>
                      <Icon name={icon} />
                    </span>
                    <span className="search-result-copy">
                      <strong>{result.title}</strong>
                      <span>
                        {label} · {result.detail}
                      </span>
                    </span>
                    <Icon name="chevron" />
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
