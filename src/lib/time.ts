export type HourFormat = '24h' | '12h'

export function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function formatTime(value: string, hourFormat: HourFormat): string {
  const [hour, minute] = value.split(':').map(Number)
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    return '--:--'

  if (hourFormat === '24h')
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

export function formatDateTime(date: Date, hourFormat: HourFormat): string {
  if (!Number.isFinite(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: hourFormat === '12h',
  }).format(date)
}
