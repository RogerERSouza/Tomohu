function clamp(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.trunc(value), 0), maximum)
}

function toTime(hour: number, minute: number): string {
  return `${String(clamp(hour, 23)).padStart(2, '0')}:${String(clamp(minute, 59)).padStart(2, '0')}`
}

function toTwentyFourHour(hour: number, period: 'AM' | 'PM'): number {
  const normalizedHour = Math.min(Math.max(Math.trunc(hour), 1), 12) % 12
  return period === 'PM' ? normalizedHour + 12 : normalizedHour
}

export function TimePicker({
  id,
  label,
  value,
  hourFormat,
  onChange,
  activeId,
  onActiveChange,
}: {
  id: string
  label: string
  value: string
  hourFormat: HourFormat
  onChange: (time: string) => void
  activeId: string | null
  onActiveChange: (id: string | null) => void
}) {
  const isOpen = activeId === id
  const [hour, minute] = value.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return (
    <div className="time-picker">
      <span>{label}</span>
      <button
        type="button"
        className="time-picker-trigger"
        aria-expanded={isOpen}
        onClick={() => onActiveChange(isOpen ? null : id)}
      >
        {formatTime(toTime(hour, minute), hourFormat)}
        <span aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div className="time-picker-panel">
          <label>
            Hora
            <input
              type="number"
              min={hourFormat === '12h' ? '1' : '0'}
              max={hourFormat === '12h' ? '12' : '23'}
              value={hourFormat === '12h' ? displayHour : hour}
              onChange={(event) =>
                onChange(
                  toTime(
                    hourFormat === '12h'
                      ? toTwentyFourHour(Number(event.target.value), period)
                      : Number(event.target.value),
                    minute,
                  ),
                )
              }
            />
          </label>
          <span className="time-picker-separator">:</span>
          <label>
            Minuto
            <input
              type="number"
              min="0"
              max="59"
              value={minute}
              onChange={(event) =>
                onChange(toTime(hour, Number(event.target.value)))
              }
            />
          </label>
          {hourFormat === '12h' && (
            <div
              className="time-period-options"
              role="radiogroup"
              aria-label="Período"
            >
              {(['AM', 'PM'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === period ? 'selected' : undefined}
                  aria-pressed={option === period}
                  onClick={() =>
                    onChange(
                      toTime(toTwentyFourHour(displayHour, option), minute),
                    )
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => onActiveChange(null)}>
            Pronto
          </button>
        </div>
      )}
    </div>
  )
}
import { formatTime, type HourFormat } from '../lib/time'
