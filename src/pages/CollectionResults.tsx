import { insertPrivateSlots } from '../features/privacy/PrivateCards'
import type { PrivateCell } from '../features/privacy/PrivateCards'
import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { SectionCard } from '../features/sections/SectionCard'
import { ContentCard } from '../features/contents/ContentCard'
import { GlobalSearchResults } from '../features/search/GlobalSearchResults'
import type { Collection } from '../features/sections/selectCollection'
import type { NotebookActions } from '../features/notebook/createNotebookActions'
import type { Notebook, Reminder, Section, Content } from '../types'

export function CollectionResults({
  notebook,
  privateCells = [],
  collection,
  actions,
  openSection,
  onEditSection,
  onEditContent,
  onOpenContent,
  onOpenReminder,
}: {
  notebook: Notebook
  privateCells?: PrivateCell[]
  collection: Collection
  actions: NotebookActions
  openSection: (id?: string) => void
  onEditSection: (section: Section) => void
  onEditContent?: (content: Content) => void
  onOpenContent: (id: string) => void
  onOpenReminder: (reminder: Reminder) => void
}) {
  const {
    isGlobalSearchActive,
    globalSearchResults,
    visibleSections,
    visibleContents,
    contentColumns,
    normalizedQuery,
  } = collection
  const sections: ReactNode[] = insertPrivateSlots<ReactNode>(
    visibleSections.map((section) => (
      <SectionCard
        key={section.id}
        section={section}
        count={
          notebook.sections.filter((child) => child.parentId === section.id)
            .length +
          notebook.contents.filter(
            (content) => content.sectionId === section.id,
          ).length
        }
        onOpen={() => openSection(section.id)}
        onEdit={() => onEditSection(section)}
        onToggleFavorite={() => actions.toggleFavorite(section.id)}
      />
    )),
    privateCells
      .filter((cell) => cell.kind === 'section')
      .map((cell) => ({ position: cell.position, value: cell.node })),
  )
  const contents = insertPrivateSlots<ReactNode>(
    visibleContents.map((content) => (
      <ContentCard
        key={content.id}
        content={content}
        onOpen={() => onOpenContent(content.id)}
        onConfigure={onEditContent ? () => onEditContent(content) : undefined}
        onCount={(delta) => actions.changeCount(content.id, delta)}
        onChange={actions.updateContent}
      />
    )),
    privateCells
      .filter((cell) => cell.kind === 'content')
      .map((cell) => ({ position: cell.position, value: cell.node })),
  )
  const columns = contentColumns.map((_, index) =>
    contents.filter(
      (_, position) => position % contentColumns.length === index,
    ),
  )
  return (
    <>
      {isGlobalSearchActive ? (
        <GlobalSearchResults
          results={globalSearchResults}
          onOpenSection={openSection}
          onOpenContent={onOpenContent}
          onOpenReminder={(id) => {
            const reminder = notebook.reminders.find(
              (current) => current.id === id,
            )
            if (reminder) onOpenReminder(reminder)
          }}
        />
      ) : (
        <>
          <div className="section-grid">{sections}</div>
          {contents.length > 0 && (
            <div className="content-columns">
              {columns.map((column, index) => (
                <div className="content-column" key={index}>
                  {column}
                </div>
              ))}
            </div>
          )}
          {!privateCells.length &&
            !visibleSections.length &&
            !visibleContents.length && (
              <div className="empty-state">
                <Icon name="note" />
                <h3>
                  {normalizedQuery
                    ? 'Nenhum resultado por aqui'
                    : 'Seção vazia'}
                </h3>
              </div>
            )}
        </>
      )}
    </>
  )
}
