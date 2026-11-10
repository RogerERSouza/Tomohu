import type { Reminder } from '../types'
import {
  formatTime,
  isValidDate,
  isValidTime,
  isValidTimestamp,
  type HourFormat,
} from './time.ts'

export type ReminderDraft = Omit<Reminder, 'id'>

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

function localDate(date: string, time = '00:00'): Date | null {
  if (!isValidDate(date) || !isValidTime(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(0)
  result.setFullYear(year, month - 1, day)
  result.setHours(hour, minute, 0, 0)
  return result
}

export function isValidReminderInterval(
  date: string,
  startTime: string,
  endDate: string,
  endTime: string,
): boolean {
  return (
    isValidDate(date) &&
    isValidDate(endDate) &&
    isValidTime(startTime) &&
    isValidTime(endTime) &&
    `${endDate}T${endTime}` > `${date}T${startTime}`
  )
}

export function isValidReminderSchedule(reminder: ReminderDraft): boolean {
  const { date, startTime, endDate, endTime, repeatTimes } = reminder
  if (
    reminder.schedule
      ? !isValidDate(date)
      : !isValidDate(date.slice(0, 10)) ||
        !isValidTimestamp(date) ||
        (date.length > 10 && !isValidTime(date.slice(11, 16)))
  )
    return false
  if (
    (startTime !== undefined && !isValidTime(startTime)) ||
    (endTime !== undefined && !isValidTime(endTime)) ||
    (endDate !== undefined &&
      (!isValidDate(endDate) || endDate < date.slice(0, 10))) ||
    (repeatTimes !== undefined &&
      (!repeatTimes.every(isValidTime) ||
        new Set(repeatTimes).size !== repeatTimes.length))
  )
    return false
  if (reminder.schedule !== 'time-range') return true
  if (repeatTimes?.length) return true
  if (!startTime) return false
  return (
    endTime === undefined ||
    isValidReminderInterval(date, startTime, endDate ?? date, endTime)
  )
}

export function getDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getReminderDate(reminder: Reminder): string {
  return reminder.schedule ? reminder.date : reminder.date.slice(0, 10)
}

export function getReminderStart(reminder: Reminder): Date | null {
  if (reminder.schedule)
    return localDate(
      reminder.date,
      reminder.repeatTimes?.[0] ?? reminder.startTime ?? '00:00',
    )
  const legacyDate = new Date(reminder.date)
  return Number.isNaN(legacyDate.getTime()) ? null : legacyDate
}

export function getReminderEnd(reminder: Reminder): Date | null {
  if (reminder.schedule === 'all-day') {
    const end = localDate(reminder.endDate ?? reminder.date)
    if (!end) return null
    end.setDate(end.getDate() + 1)
    return end
  }
  if (reminder.schedule !== 'time-range') return null
  if (reminder.repeatTimes?.length)
    return localDate(reminder.endDate ?? reminder.date, '23:59')
  if (!reminder.endTime) return null
  const start = getReminderStart(reminder)
  const end = localDate(reminder.endDate ?? reminder.date, reminder.endTime)
  if (!start || !end) return null
  return end > start ? end : null
}

export function getReminderNextOccurrence(
  reminder: Reminder,
  now = new Date(),
): Date | null {
  const times = reminder.repeatTimes
  if (!times?.length) return getReminderStart(reminder)
  const lastDay = localDate(reminder.endDate ?? reminder.date)
  if (!lastDay) return null
  const firstDay = localDate(reminder.date)
  if (!firstDay) return null
  const cursor = new Date(
    Math.max(
      firstDay.getTime(),
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    ),
  )
  const orderedTimes = [...times].sort()
  while (cursor <= lastDay) {
    const day = getDateInputValue(cursor)
    for (const time of orderedTimes) {
      const candidate = localDate(day, time)
      if (candidate && candidate >= now) return candidate
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

export function formatReminderDate(
  reminder: Reminder,
  hourFormat: HourFormat = '24h',
): string {
  const start = getReminderStart(reminder)
  if (!start) return 'Data inválida'
  const end = getReminderEnd(reminder)
  const isMultiDay = Boolean(
    reminder.endDate && reminder.endDate !== reminder.date,
  )
  if (reminder.schedule === 'all-day') {
    if (isMultiDay && end)
      return `${dateFormatter.format(start)} — ${dateFormatter.format(new Date(end.getTime() - 1))}`
    return `${dateFormatter.format(start)} · Dia todo`
  }
  if (reminder.schedule === 'time-range') {
    if (reminder.repeatTimes?.length)
      return `${dateFormatter.format(start)} — ${dateFormatter.format(end ?? start)} · ${reminder.repeatTimes.map((time) => formatTime(time, hourFormat)).join(', ')}`
    if (isMultiDay && end)
      return `${dateFormatter.format(start)} ${formatTime(reminder.startTime ?? '', hourFormat)} → ${dateFormatter.format(end)} ${formatTime(reminder.endTime ?? '', hourFormat)}`
    if (reminder.startTime && !reminder.endTime)
      return `${dateFormatter.format(start)} · ${formatTime(reminder.startTime, hourFormat)}`
    return `${dateFormatter.format(start)} · ${formatTime(reminder.startTime ?? '', hourFormat)}–${formatTime(reminder.endTime ?? '', hourFormat)}`
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)
}

export function formatReminderCountdown(
  reminder: Reminder,
  now = new Date(),
): string {
  const start = reminder.repeatTimes?.length
    ? getReminderNextOccurrence(reminder, now)
    : getReminderStart(reminder)
  if (!start) return ''
  const end = getReminderEnd(reminder)
  if (now >= start)
    return end && now < end
      ? reminder.schedule === 'all-day'
        ? 'Hoje'
        : 'Em andamento'
      : 'Encerrado'

  const totalSeconds = Math.floor((start.getTime() - now.getTime()) / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `Faltam ${days}d ${String(hours).padStart(2, '0')}h`
  if (hours > 0)
    return `Faltam ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`
  return `Faltam ${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}s`
}

export function isReminderExpired(
  reminder: Reminder,
  now = new Date(),
): boolean {
  const nextOccurrence = reminder.repeatTimes?.length
    ? getReminderNextOccurrence(reminder, now)
    : getReminderStart(reminder)
  if (nextOccurrence && nextOccurrence > now) return false
  const end = getReminderEnd(reminder)
  return !end || now >= end
}

export function getReminderPriority(
  reminder: Reminder,
  now = new Date(),
): number {
  const start = reminder.repeatTimes?.length
    ? getReminderNextOccurrence(reminder, now)
    : getReminderStart(reminder)
  if (!start) return Number.POSITIVE_INFINITY
  const end = getReminderEnd(reminder)
  if (start > now) return start.getTime()
  if (end && end > now) return now.getTime()
  return Number.MAX_SAFE_INTEGER + start.getTime()
}
