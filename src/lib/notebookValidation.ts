import type { Notebook } from '../types'
import { isValidReminderSchedule } from './reminders.ts'
import { isValidTimestamp } from './time.ts'

function isRecord(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item))
}

function hasNotebookShape(value: unknown): value is Notebook {
  if (!isRecord(value)) return false
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
    value.schemaVersion === 1 &&
    Array.isArray(value.sections) &&
    value.sections.every(
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
    Array.isArray(value.reminders) &&
    value.reminders.every(
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
    Array.isArray(value.contents) &&
    value.contents.every((content) => {
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

function hasUniqueIds(items: { id: string }[]): boolean {
  return (
    items.every((item) => item.id.trim().length > 0) &&
    new Set(items.map((item) => item.id)).size === items.length
  )
}

function hasValidSectionTree(sections: Notebook['sections']): boolean {
  const parents = new Map(
    sections.map((section) => [section.id, section.parentId]),
  )
  const complete = new Set<string>()
  for (const section of sections) {
    const path = new Set<string>()
    let current: string | null = section.id
    while (current !== null && !complete.has(current)) {
      if (!parents.has(current) || path.has(current)) return false
      path.add(current)
      current = parents.get(current) ?? null
    }
    for (const id of path) complete.add(id)
  }
  return true
}

export function isNotebook(value: unknown): value is Notebook {
  if (!hasNotebookShape(value)) return false
  if (
    ![value.sections, value.contents, value.reminders].every(hasUniqueIds) ||
    !hasValidSectionTree(value.sections)
  )
    return false
  const sectionIds = new Set(value.sections.map((section) => section.id))
  return (
    value.reminders.every(isValidReminderSchedule) &&
    value.contents.every((content) => {
      if (!sectionIds.has(content.sectionId)) return false
      if (content.kind === 'checklist' || content.kind === 'tutorial')
        return hasUniqueIds(content.items)
      if (content.kind === 'counter') {
        const total = content.entries.reduce(
          (sum, entry) => sum + entry.delta,
          0,
        )
        return (
          hasUniqueIds(content.entries) && Number.isFinite(total) && total >= 0
        )
      }
      return true
    })
  )
}
