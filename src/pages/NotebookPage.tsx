import type { PrivateCell } from '../features/privacy/PrivateCards'
import { Icon } from '../components/Icon'
import { ReminderStrip } from '../features/reminders/ReminderStrip'
import { CollectionToolbar } from '../features/sections/CollectionToolbar'
import type { Collection } from '../features/sections/selectCollection'
import type { CollectionControls } from '../features/sections/useCollectionControls'
import type { NotebookActions } from '../features/notebook/createNotebookActions'
import type { Notebook, Reminder, Section, Content } from '../types'
import type { HourFormat } from '../lib/time'
import { CollectionResults } from './CollectionResults'

export function NotebookPage({
  notebook,
  privateCells = [],
  currentSection,
  isHome,
  now,
  hourFormat,
  collection,
  controls,
  actions,
  openSection,
  onEditSection,
  onEditContent,
  onOpenContent,
  onOpenReminder,
  onCreateReminder,
  onCreateSection,
  onCreateContent,
}: {
  notebook: Notebook
  privateCells?: PrivateCell[]
  currentSection: Section | undefined
  isHome: boolean
  now: Date
  hourFormat: HourFormat
  collection: Collection
  controls: CollectionControls
  actions: NotebookActions
  openSection: (id?: string) => void
  onEditSection: (section: Section) => void
  onEditContent?: (content: Content) => void
  onOpenContent: (id: string) => void
  onOpenReminder: (reminder: Reminder) => void
  onCreateReminder: () => void
  onCreateSection: () => void
  onCreateContent: () => void
}) {
  const {
    isGlobalSearchActive,
    globalSearchResults,
    visibleSections,
    visibleContents,
  } = collection
  return (
    <>
      {!isHome && (
        <div className="page-heading">
          <h1>
            {currentSection?.emoji} {currentSection?.title}
          </h1>
          <button
            className="secondary-button"
            onClick={() => {
              if (currentSection) onEditSection(currentSection)
            }}
          >
            <Icon name="more" />
            Editar seção
          </button>
        </div>
      )}
      {isHome && (
        <ReminderStrip
          items={notebook.reminders}
          now={now}
          hourFormat={hourFormat}
          onCreate={onCreateReminder}
          onOpen={onOpenReminder}
        />
      )}
      <section aria-labelledby="sections-title" className="sections-area">
        <div className="subheading">
          <h2 id="sections-title">
            {isGlobalSearchActive
              ? 'Resultados da busca'
              : isHome
                ? 'Suas seções'
                : 'Dentro desta seção'}
            <span className="section-count">
              {isGlobalSearchActive
                ? globalSearchResults.length
                : visibleSections.length +
                  visibleContents.length +
                  privateCells.length}
            </span>
          </h2>
        </div>
        <CollectionToolbar
          isHome={isHome}
          collection={collection}
          controls={controls}
          onCreateSection={onCreateSection}
          onCreateContent={onCreateContent}
        />
        <CollectionResults
          notebook={notebook}
          privateCells={privateCells}
          collection={collection}
          actions={actions}
          openSection={openSection}
          onEditSection={onEditSection}
          onEditContent={onEditContent}
          onOpenContent={onOpenContent}
          onOpenReminder={onOpenReminder}
        />
      </section>
    </>
  )
}
