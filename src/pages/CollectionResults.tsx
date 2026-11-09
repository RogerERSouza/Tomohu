import { Icon } from '../components/Icon'
import { SectionCard } from '../features/sections/SectionCard'
import { ContentCard } from '../features/contents/ContentCard'
import { GlobalSearchResults } from '../features/search/GlobalSearchResults'
import type { Collection } from '../features/sections/selectCollection'
import type { NotebookActions } from '../features/notebook/createNotebookActions'
import type { Notebook, Reminder, Section } from '../types'

export function CollectionResults({
  notebook,
  collection,
  actions,
  openSection,
  onEditSection,
  onOpenContent,
  onOpenReminder,
}: {
  notebook: Notebook
  collection: Collection
  actions: NotebookActions
  openSection: (id?: string) => void
  onEditSection: (section: Section) => void
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
          <div className="section-grid">
            {visibleSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                count={
                  notebook.sections.filter(
                    (child) => child.parentId === section.id,
                  ).length +
                  notebook.contents.filter(
                    (content) => content.sectionId === section.id,
                  ).length
                }
                onOpen={() => openSection(section.id)}
                onEdit={() => onEditSection(section)}
                onToggleFavorite={() => actions.toggleFavorite(section.id)}
              />
            ))}
          </div>
          {visibleContents.length > 0 && (
            <div className="content-columns">
              {contentColumns.map((column, index) => (
                <div className="content-column" key={index}>
                  {column.map((content) => (
                    <ContentCard
                      key={content.id}
                      content={content}
                      onOpen={() => onOpenContent(content.id)}
                      onCount={(delta) =>
                        actions.changeCount(content.id, delta)
                      }
                      onChange={actions.updateContent}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          {!visibleSections.length && !visibleContents.length && (
            <div className="empty-state">
              <Icon name="note" />
              <h3>
                {normalizedQuery ? 'Nenhum resultado por aqui' : 'Seção vazia'}
              </h3>
            </div>
          )}
        </>
      )}
    </>
  )
}
