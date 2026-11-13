import type { PrivateCell } from '../features/privacy/PrivateCards'
import type { ItemPrivacyControls } from '../features/privacy/privacyTypes'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { useNotebook } from '../features/notebook/useNotebook'
import { useNow } from '../hooks/useNow'
import { useCompactLayout } from '../hooks/useCompactLayout'
import { createNotebookActions } from '../features/notebook/createNotebookActions'
import { usePreferences } from '../features/settings/usePreferences'
import { useCollectionControls } from '../features/sections/useCollectionControls'
import { selectCollection } from '../features/sections/selectCollection'
import { useBackupFiles } from '../features/backup/useBackupFiles'
import { isReminderExpired } from '../lib/reminders'
import type { Reminder } from '../types'
import { ContentPage } from '../pages/ContentPage'
import { MissingPage } from '../pages/MissingPage'
import { NotebookPage } from '../pages/NotebookPage'
import { Breadcrumb } from './Breadcrumb'
import { BottomNavigation } from './BottomNavigation'
import { EditorDialog } from './EditorDialog'
import type { Editor } from './editor'
import { navigate, useNotebookRoute } from './useNotebookRoute'
import '../App.css'

export function NotebookView({
  controller,
  accountPanel,
  status,
  interactionBlocked = false,
  onExport,
  privacy,
  beforeSectionNavigate,
  privateCells,
  initialEditor = null,
}: {
  controller: ReturnType<typeof useNotebook>
  accountPanel: ReactNode
  status?: ReactNode
  interactionBlocked?: boolean
  onExport?: () => void
  initialEditor?: Editor
  privateCells?: (parentId: string | null) => PrivateCell[]
  privacy?: ItemPrivacyControls
  beforeSectionNavigate?: (id?: string) => boolean
}) {
  const { notebook, setNotebook, replaceNotebook, storageError } = controller
  const { currentContent, currentSection, isHome, isMissing, path } =
    useNotebookRoute(notebook)
  const actions = createNotebookActions(setNotebook)
  const preferences = usePreferences()
  const controls = useCollectionControls()
  const now = useNow()
  const isCompactLayout = useCompactLayout()
  const collection = selectCollection(
    notebook,
    currentSection,
    isHome,
    controls,
    isCompactLayout,
  )
  const [editor, setEditor] = useState<Editor>(initialEditor)
  const {
    importInputRef,
    importError,
    chooseBackup,
    exportNotebook: downloadBackup,
  } = useBackupFiles(notebook, (backup, fileName) =>
    setEditor({ kind: 'import-backup', backup, fileName }),
  )
  const exportNotebook = onExport ?? downloadBackup
  function openSection(id?: string) {
    if (beforeSectionNavigate && !beforeSectionNavigate(id)) return
    controls.reset()
    navigate(id ? 'section' : undefined, id)
  }
  function openReminder(reminder: Reminder) {
    setEditor({
      kind: isReminderExpired(reminder, now) ? 'expired-reminder' : 'reminder',
      reminder,
    })
  }
  return (
    <div className="app-shell">
      <main className="main-content" inert={interactionBlocked}>
        {status}
        {storageError && (
          <div className="storage-warning" role="alert">
            {storageError}
            <button className="text-button" onClick={exportNotebook}>
              Exportar cópia
            </button>
          </div>
        )}
        {!isHome && (
          <Breadcrumb
            path={path}
            currentContent={currentContent}
            currentSection={currentSection}
            openSection={openSection}
          />
        )}
        {isMissing ? (
          <MissingPage onHome={() => openSection()} />
        ) : currentContent ? (
          <ContentPage
            content={currentContent}
            onConfigure={() =>
              setEditor({ kind: 'content-settings', content: currentContent })
            }
            actions={actions}
            hourFormat={preferences.hourFormat}
            openSection={openSection}
          />
        ) : (
          <NotebookPage
            notebook={notebook}
            privateCells={privateCells?.(currentSection?.id ?? null)}
            currentSection={currentSection}
            isHome={isHome}
            now={now}
            hourFormat={preferences.hourFormat}
            collection={collection}
            controls={controls}
            actions={actions}
            openSection={openSection}
            onEditSection={(section) => setEditor({ kind: 'section', section })}
            onEditContent={(content) =>
              setEditor({ kind: 'content-settings', content })
            }
            onOpenContent={(id) => navigate('content', id)}
            onOpenReminder={openReminder}
            onCreateReminder={() => setEditor({ kind: 'reminder' })}
            onCreateSection={() => setEditor({ kind: 'section' })}
            onCreateContent={() => setEditor({ kind: 'content' })}
          />
        )}
      </main>
      <BottomNavigation
        isHome={isHome}
        settingsOpen={editor?.kind === 'settings'}
        onHome={() => {
          setEditor(null)
          openSection()
        }}
        onSettings={() => setEditor({ kind: 'settings' })}
      />
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={chooseBackup}
      />
      {editor && (
        <EditorDialog
          editor={editor}
          privacy={privacy}
          importBlocked={interactionBlocked}
          setEditor={setEditor}
          currentSection={currentSection}
          preferences={preferences}
          actions={actions}
          replaceNotebook={replaceNotebook}
          openSection={openSection}
          exportNotebook={exportNotebook}
          onImport={() => importInputRef.current?.click()}
          importError={importError}
          replacementError={storageError}
          accountPanel={accountPanel}
        />
      )}
    </div>
  )
}
