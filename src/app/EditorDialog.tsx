import type { ItemPrivacyControls } from '../features/privacy/privacyTypes'
import { ContentSettings } from '../features/contents/ContentSettings'
import type { Dispatch, SetStateAction, ReactNode } from 'react'
import { Modal } from '../components/Modal'
import { SectionForm } from '../features/sections/SectionForm'
import { ContentForm } from '../features/contents/ContentForm'
import { ReminderForm } from '../features/reminders/ReminderForm'
import { ExpiredReminderPanel } from '../features/reminders/ExpiredReminderPanel'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import type { usePreferences } from '../features/settings/usePreferences'
import { ImportBackupPanel } from '../features/backup/ImportBackupPanel'
import type { NotebookActions } from '../features/notebook/createNotebookActions'
import type { Notebook, Section } from '../types'
import type { Editor } from './editor'
import { navigate } from './useNotebookRoute'

type Props = {
  importBlocked: boolean
  editor: NonNullable<Editor>
  setEditor: Dispatch<SetStateAction<Editor>>
  currentSection: Section | undefined
  preferences: ReturnType<typeof usePreferences>
  actions: NotebookActions
  replaceNotebook: (notebook: Notebook) => boolean
  openSection: (id?: string) => void
  exportNotebook: () => void
  onImport: () => void
  importError: string
  replacementError: string
  privacy?: ItemPrivacyControls
  accountPanel: ReactNode
}
export function EditorDialog({
  editor,
  importBlocked,
  setEditor,
  currentSection,
  preferences,
  actions,
  replaceNotebook,
  openSection,
  exportNotebook,
  onImport,
  importError,
  replacementError,
  accountPanel,
  privacy,
}: Props) {
  const close = () => setEditor(null)
  return (
    <Modal
      title={
        editor.kind === 'section'
          ? editor.section
            ? 'Editar seção'
            : 'Nova seção'
          : editor.kind === 'content-settings'
            ? 'Configurar conteúdo'
            : editor.kind === 'content'
              ? 'Novo conteúdo'
              : editor.kind === 'settings'
                ? 'Ajustes'
                : editor.kind === 'expired-reminder'
                  ? 'Prazo encerrado'
                  : editor.kind === 'import-backup'
                    ? 'Importar backup'
                    : editor.reminder
                      ? 'Editar lembrete'
                      : 'Novo lembrete'
      }
      onClose={close}
    >
      {editor.kind === 'settings' && (
        <SettingsPanel
          {...preferences}
          importBlocked={importBlocked}
          onExport={exportNotebook}
          onImport={onImport}
          importError={importError}
          accountPanel={accountPanel}
        />
      )}
      {editor.kind === 'import-backup' && (
        <ImportBackupPanel
          fileName={editor.fileName}
          blocked={importBlocked}
          error={replacementError}
          onExport={exportNotebook}
          onBack={() => setEditor({ kind: 'settings' })}
          onReplace={() => {
            if (replaceNotebook(editor.backup)) {
              close()
              openSection()
            }
          }}
        />
      )}
      {editor.kind === 'section' && (
        <SectionForm
          section={editor.section}
          privacyState={privacy?.state('section', editor.section?.id)}
          onSave={(values, makePrivate) => {
            if (privacy) {
              const state = privacy.state('section', editor.section?.id)
              privacy.section(
                editor.section,
                currentSection?.id ?? null,
                values,
                Boolean(makePrivate),
              )
              if (
                (state === 'public' && makePrivate) ||
                (state === 'private' && !makePrivate)
              )
                return
              close()
              return
            }
            actions.saveSection(
              editor.section,
              currentSection?.id ?? null,
              values,
            )
            close()
          }}
          onRemove={() => {
            if (!editor.section) return
            actions.deleteSection(editor.section.id)
            close()
            openSection(editor.section.parentId ?? undefined)
          }}
        />
      )}
      {editor.kind === 'content' && currentSection && (
        <ContentForm
          privacyState={privacy?.state('content')}
          onSave={(kind, title, makePrivate) => {
            if (privacy && makePrivate) {
              const id = privacy.content(
                undefined,
                currentSection.id,
                kind,
                title,
                true,
              )
              if (privacy.state('content') === 'inherited') {
                close()
                if (id) navigate('content', id)
              }
              return
            }
            const content = actions.addContent(kind, currentSection.id, title)
            close()
            navigate('content', content.id)
          }}
        />
      )}
      {editor.kind === 'content-settings' && (
        <ContentSettings
          content={editor.content}
          privacyState={privacy?.state('content', editor.content.id)}
          onSave={(title, makePrivate) => {
            if (privacy) {
              const state = privacy.state('content', editor.content.id)
              privacy.content(
                editor.content,
                editor.content.sectionId,
                editor.content.kind,
                title,
                makePrivate,
              )
              if (
                (state === 'public' && makePrivate) ||
                (state === 'private' && !makePrivate)
              )
                return
            } else actions.updateContent({ ...editor.content, title })
            close()
          }}
        />
      )}
      {editor.kind === 'reminder' && (
        <ReminderForm
          reminder={editor.reminder}
          hourFormat={preferences.hourFormat}
          onSave={(values) => {
            actions.saveReminder(editor.reminder?.id, values)
            close()
          }}
          onRemove={() => {
            actions.deleteReminder(editor.reminder?.id)
            close()
          }}
        />
      )}
      {editor.kind === 'expired-reminder' && (
        <ExpiredReminderPanel
          onRemove={() => {
            actions.deleteReminder(editor.reminder.id)
            close()
          }}
          onReschedule={() =>
            setEditor({ kind: 'reminder', reminder: editor.reminder })
          }
        />
      )}
      {privacy?.error &&
        ['section', 'content', 'content-settings'].includes(editor.kind) && (
          <p role="alert">{privacy.error}</p>
        )}
    </Modal>
  )
}
