import type { Content, CounterEntry, Notebook, Section } from '../types'
import { isValidTimestamp } from './time.ts'

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
  if (!isNotebook(parsed)) throw new Error('Invalid notebook backup')
  return parsed
}

export function isNotebook(value: unknown): value is Notebook {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  const isRecord = (item: unknown): item is Record<string, unknown> =>
    Boolean(item && typeof item === 'object')
  const isText = (item: unknown) => typeof item === 'string'
  const validItems = (items: unknown) =>
    Array.isArray(items) &&
    items.every(
      (item) =>
        isRecord(item) &&
        isText(item.id) &&
        isText(item.text) &&
        typeof item.completed === 'boolean',
    )
  return (
    data.schemaVersion === 1 &&
    Array.isArray(data.sections) &&
    data.sections.every(
      (section) =>
        isRecord(section) &&
        isText(section.id) &&
        (section.parentId === null || isText(section.parentId)) &&
        isText(section.title) &&
        isText(section.emoji) &&
        isText(section.color) &&
        (section.favorite === undefined ||
          typeof section.favorite === 'boolean') &&
        (section.tags === undefined ||
          (Array.isArray(section.tags) && section.tags.every(isText))),
    ) &&
    Array.isArray(data.reminders) &&
    data.reminders.every(
      (reminder) =>
        isRecord(reminder) &&
        isText(reminder.id) &&
        isText(reminder.title) &&
        isText(reminder.date) &&
        (reminder.schedule === undefined ||
          reminder.schedule === 'all-day' ||
          reminder.schedule === 'time-range') &&
        (reminder.startTime === undefined || isText(reminder.startTime)) &&
        (reminder.endDate === undefined || isText(reminder.endDate)) &&
        (reminder.endTime === undefined || isText(reminder.endTime)) &&
        (reminder.repeatTimes === undefined ||
          (Array.isArray(reminder.repeatTimes) &&
            reminder.repeatTimes.every(isText))) &&
        (reminder.duration === undefined ||
          reminder.duration === 'single-day' ||
          reminder.duration === 'multi-day') &&
        (reminder.countdownFormat === undefined ||
          reminder.countdownFormat === 'automatic' ||
          reminder.countdownFormat === 'days-hours' ||
          reminder.countdownFormat === 'hours-minutes' ||
          reminder.countdownFormat === 'minutes-seconds'),
    ) &&
    Array.isArray(data.contents) &&
    data.contents.every((content) => {
      if (
        !isRecord(content) ||
        !isText(content.id) ||
        !isText(content.sectionId) ||
        !isText(content.title)
      )
        return false
      switch (content.kind) {
        case 'note':
          return isText(content.text)
        case 'checklist':
          return validItems(content.items)
        case 'tutorial':
          return isText(content.text) && validItems(content.items)
        case 'counter':
          return (
            Array.isArray(content.entries) &&
            content.entries.every(
              (entry) =>
                isRecord(entry) &&
                isText(entry.id) &&
                typeof entry.delta === 'number' &&
                Number.isFinite(entry.delta) &&
                isValidTimestamp(entry.createdAt) &&
                isText(entry.note),
            )
          )
        default:
          return false
      }
    })
  )
}
