import type { Content, CounterEntry, Notebook, Section } from '../types'
import { isNotebook } from './notebookValidation.ts'
import { readWorkspaceCache } from './workspaceCache.ts'

export { isNotebook } from './notebookValidation.ts'

export const STORAGE_KEY = 'task.notebook.v1'
export const CONTENT_LABELS = {
  note: 'Nota',
  checklist: 'Checklist',
  tutorial: 'Tutorial',
  counter: 'Contador',
}
export const SECTION_COLORS = [
  '#a7bcec',
  '#c5a5dc',
  '#b4cbb3',
  '#edcf94',
  '#dfaba5',
]

export function getCounterTotal(entries: CounterEntry[]): number {
  return entries.reduce((total, entry) => total + entry.delta, 0)
}

export function getSectionPath(
  sections: Section[],
  id: string | null,
): Section[] {
  const path: Section[] = []
  const visited = new Set<string>()
  let current = sections.find((section) => section.id === id)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.unshift(current)
    current = sections.find((section) => section.id === current?.parentId)
  }
  return path
}

export function removeSectionTree(notebook: Notebook, id: string): Notebook {
  const sectionIdsToRemove = new Set([id])
  let foundChild = true

  while (foundChild) {
    foundChild = false
    for (const section of notebook.sections) {
      if (
        section.parentId !== null &&
        sectionIdsToRemove.has(section.parentId) &&
        !sectionIdsToRemove.has(section.id)
      ) {
        sectionIdsToRemove.add(section.id)
        foundChild = true
      }
    }
  }

  return {
    ...notebook,
    sections: notebook.sections.filter(
      (section) => !sectionIdsToRemove.has(section.id),
    ),
    contents: notebook.contents.filter(
      (content) => !sectionIdsToRemove.has(content.sectionId),
    ),
  }
}

export function removeContent(notebook: Notebook, id: string): Notebook {
  return {
    ...notebook,
    contents: notebook.contents.filter((content) => content.id !== id),
  }
}

export function createContent(
  kind: Content['kind'],
  sectionId: string,
  title: string,
): Content {
  const base = { id: crypto.randomUUID(), sectionId, title }
  switch (kind) {
    case 'note':
      return { ...base, kind, text: '' }
    case 'checklist':
      return { ...base, kind, items: [] }
    case 'tutorial':
      return { ...base, kind, text: '', items: [] }
    case 'counter':
      return { ...base, kind, entries: [] }
  }
}

export function parseNotebookBackup(text: string): Notebook {
  const parsed: unknown = JSON.parse(text)
  return isNotebook(parsed) ? parsed : readWorkspaceCache(parsed).snapshot
}
