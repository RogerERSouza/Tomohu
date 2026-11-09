import type { Dispatch, SetStateAction } from 'react'
import {
  createContent,
  getCounterTotal,
  removeContent,
  removeSectionTree,
} from '../../lib/notebook'
import type { ReminderDraft } from '../../lib/reminders'
import type { Content, ContentKind, Notebook, Section } from '../../types'

export function createNotebookActions(
  setNotebook: Dispatch<SetStateAction<Notebook>>,
) {
  function updateContent(updatedContent: Content) {
    setNotebook((current) => ({
      ...current,
      contents: current.contents.map((content) =>
        content.id === updatedContent.id ? updatedContent : content,
      ),
    }))
  }
  function changeCount(id: string, delta: number) {
    setNotebook((current) => ({
      ...current,
      contents: current.contents.map((content) => {
        if (
          content.id !== id ||
          content.kind !== 'counter' ||
          getCounterTotal(content.entries) + delta < 0
        )
          return content
        return {
          ...content,
          entries: [
            ...content.entries,
            {
              id: crypto.randomUUID(),
              delta,
              createdAt: new Date().toISOString(),
              note: '',
            },
          ],
        }
      }),
    }))
  }

  function saveSection(
    existing: Section | undefined,
    parentId: string | null,
    values: Pick<Section, 'title' | 'emoji' | 'color' | 'tags'>,
  ) {
    setNotebook((current) => ({
      ...current,
      sections: existing
        ? current.sections.map((section) =>
            section.id === existing.id ? { ...section, ...values } : section,
          )
        : [
            ...current.sections,
            { id: crypto.randomUUID(), parentId, favorite: false, ...values },
          ],
    }))
  }
  function deleteSection(id: string) {
    setNotebook((current) => removeSectionTree(current, id))
  }
  function toggleFavorite(id: string) {
    setNotebook((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id
          ? { ...section, favorite: !section.favorite }
          : section,
      ),
    }))
  }
  function addContent(kind: ContentKind, sectionId: string, title: string) {
    const content = createContent(kind, sectionId, title)
    setNotebook((current) => ({
      ...current,
      contents: [...current.contents, content],
    }))
    return content
  }
  function deleteContent(id: string) {
    setNotebook((current) => removeContent(current, id))
  }
  function saveReminder(id: string | undefined, values: ReminderDraft) {
    setNotebook((current) => ({
      ...current,
      reminders: id
        ? current.reminders.map((reminder) =>
            reminder.id === id ? { id: reminder.id, ...values } : reminder,
          )
        : [...current.reminders, { id: crypto.randomUUID(), ...values }],
    }))
  }
  function deleteReminder(id: string | undefined) {
    setNotebook((current) => ({
      ...current,
      reminders: current.reminders.filter((reminder) => reminder.id !== id),
    }))
  }
  return {
    updateContent,
    changeCount,
    saveSection,
    deleteSection,
    toggleFavorite,
    addContent,
    deleteContent,
    saveReminder,
    deleteReminder,
  }
}
export type NotebookActions = ReturnType<typeof createNotebookActions>
