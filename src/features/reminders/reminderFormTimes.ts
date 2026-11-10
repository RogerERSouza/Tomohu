import { formatTime } from '../../lib/time.ts'
import type { Reminder } from '../../types'

function normalizeTime(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = formatTime(value, '24h')
  return normalized === '--:--' ? undefined : normalized
}

export function getInitialReminderTimes(reminder?: Reminder) {
  const startTime =
    normalizeTime(reminder?.startTime) ??
    normalizeTime(reminder?.date.slice(11, 16)) ??
    '09:00'
  const [hour, minute] = startTime.split(':').map(Number)
  const nextHour = `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return {
    startTime,
    endTime: normalizeTime(reminder?.endTime) ?? nextHour,
  }
}
