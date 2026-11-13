import { createContent } from '../../lib/notebook'
import type { Notebook } from '../../types'
import type { NotebookActions } from '../notebook/createNotebookActions'
import type { PrivacyController } from './usePrivacy'
import type { ItemPrivacyControls } from './privacyTypes'

export function publicPrivacyControls(
  notebook: Notebook,
  revision: number,
  blocked: boolean,
  actions: NotebookActions,
  privacy: PrivacyController,
): ItemPrivacyControls {
  const ready = () => {
    if (blocked) {
      privacy.reportError(
        'Sincronize as alterações pendentes antes de mudar a privacidade.',
      )
      return false
    }
    return true
  }
  return {
    error: privacy.error,
    state: () => 'public',
    section: (existing, parentId, values, makePrivate) => {
      if (!makePrivate) {
        actions.saveSection(existing, parentId, values)
        return
      }
      if (!ready()) return
      if (existing) {
        privacy.protect('section', existing.id, revision, {
          section: { ...existing, ...values },
        })
        return
      }
      const section = { id: crypto.randomUUID(), parentId: null, ...values }
      privacy.create({
        kind: 'section',
        root_id: section.id,
        parent_id: parentId,
        revision,
        snapshot: {
          schemaVersion: 1,
          sections: [section],
          contents: [],
          reminders: [],
        },
      })
    },
    content: (existing, parentId, kind, title, makePrivate) => {
      if (!makePrivate) {
        if (existing) actions.updateContent({ ...existing, title })
        else actions.addContent(kind, parentId, title)
        return
      }
      if (!ready()) return
      if (existing) {
        privacy.protect('content', existing.id, revision, { title })
        return
      }
      const content = createContent(kind, parentId, title)
      const section = notebook.sections.find((s) => s.id === parentId)
      if (!section) {
        privacy.reportError('A seção de destino não está disponível.')
        return
      }
      privacy.create({
        kind: 'content',
        root_id: content.id,
        parent_id: parentId,
        revision,
        snapshot: {
          schemaVersion: 1,
          sections: [{ ...section, parentId: null }],
          contents: [content],
          reminders: [],
        },
      })
    },
  }
}
