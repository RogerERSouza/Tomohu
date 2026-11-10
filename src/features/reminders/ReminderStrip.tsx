import { Icon } from '../../components/Icon'
import {
  formatReminderCountdown,
  formatReminderDate,
  getReminderPriority,
} from '../../lib/reminders'
import type { HourFormat } from '../../lib/time'
import type { Reminder } from '../../types'

export function ReminderStrip({
  items,
  now,
  hourFormat,
  onCreate,
  onOpen,
}: {
  items: Reminder[]
  now: Date
  hourFormat: HourFormat
  onCreate: () => void
  onOpen: (reminder: Reminder) => void
}) {
  const reminders = [...items].sort(
    (first, second) =>
      getReminderPriority(first, now) - getReminderPriority(second, now),
  )
  return (
    <section className="reminders-section" aria-labelledby="reminders-title">
      <div className="subheading">
        <h1 id="reminders-title">Lembretes</h1>
        <button className="text-button" onClick={onCreate}>
          <Icon name="plus" />
          Novo lembrete
        </button>
      </div>
      {reminders.length > 0 && (
        <div className="reminder-strip">
          {reminders.map((reminder) => (
            <button
              key={reminder.id}
              className="reminder-paper"
              onClick={() => onOpen(reminder)}
            >
              <span className="paper-tape" />
              <span className="reminder-date">
                {formatReminderDate(reminder, hourFormat)}
              </span>
              <strong>{reminder.title}</strong>
              <span className="reminder-countdown">
                {formatReminderCountdown(reminder, now)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
