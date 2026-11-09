import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPicker } from '../../components/CalendarPicker'
import { TimePicker } from '../../components/TimePicker'
import { getDateInputValue, getReminderDate } from '../../lib/reminders'
import type { ReminderDraft } from '../../lib/reminders'
import type { HourFormat } from '../../lib/time'
import type { Reminder } from '../../types'

function getTimeOneHourLater(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function ReminderForm({
  reminder,
  hourFormat,
  onSave,
  onRemove,
}: {
  reminder?: Reminder
  hourFormat: HourFormat
  onSave: (values: ReminderDraft) => void
  onRemove: () => void
}) {
  const initialDate = reminder ? getReminderDate(reminder) : getDateInputValue()
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [hasTriedToSave, setHasTriedToSave] = useState(false)
  const [date, setDate] = useState(initialDate)
  const [spansMultipleDays, setSpansMultipleDays] = useState(
    reminder?.duration === 'multi-day' ||
      Boolean(reminder?.endDate && reminder.endDate !== initialDate),
  )
  const [endDate, setEndDate] = useState(reminder?.endDate ?? initialDate)
  const [occurrence, setOccurrence] = useState<
    'all-day' | 'single-time' | 'continuous' | 'daily-times'
  >(
    reminder?.schedule === 'all-day'
      ? 'all-day'
      : reminder?.repeatTimes?.length
        ? 'daily-times'
        : reminder?.endTime
          ? 'continuous'
          : reminder
            ? 'single-time'
            : 'all-day',
  )
  const legacyTime = reminder?.date.slice(11, 16)
  const [startTime, setStartTime] = useState(
    reminder?.startTime ?? legacyTime ?? '09:00',
  )
  const [endTime, setEndTime] = useState(
    reminder?.endTime ?? getTimeOneHourLater(legacyTime ?? '09:00'),
  )
  const [repeatTimes, setRepeatTimes] = useState(
    reminder?.repeatTimes?.length ? reminder.repeatTimes : ['09:00'],
  )
  const [timeToAdd, setTimeToAdd] = useState('14:00')
  const [showDuplicateTimeWarning, setShowDuplicateTimeWarning] =
    useState(false)
  const [activeTimePickerId, setActiveTimePickerId] = useState<string | null>(
    null,
  )
  const invalidDateRange = spansMultipleDays && endDate < date
  const invalidTimeRange =
    occurrence === 'continuous' &&
    (!endTime || (!spansMultipleDays && endTime <= startTime))
  const invalidRepeatTimes =
    occurrence === 'daily-times' && repeatTimes.length === 0
  function changeStartDate(nextDate: string) {
    setDate(nextDate)
    setEndDate(nextDate)
  }
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setHasTriedToSave(true)
    if (
      title.trim() &&
      date &&
      !invalidDateRange &&
      !invalidTimeRange &&
      !invalidRepeatTimes
    )
      onSave({
        title: title.trim(),
        date,
        schedule: occurrence === 'all-day' ? 'all-day' : 'time-range',
        duration: spansMultipleDays ? 'multi-day' : 'single-day',
        ...(spansMultipleDays ? { endDate } : {}),
        ...(occurrence === 'single-time' ? { startTime } : {}),
        ...(occurrence === 'continuous' ? { startTime, endTime } : {}),
        ...(occurrence === 'daily-times'
          ? { repeatTimes: [...repeatTimes].sort() }
          : {}),
        countdownFormat: 'automatic',
      })
  }
  return (
    <form className="modal-form" noValidate onSubmit={handleSubmit}>
      <label className="field">
        <span>Lembrete</span>
        <input
          required
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="O que você quer lembrar?"
        />
        {hasTriedToSave && !title.trim() && (
          <small className="form-warning" role="alert">
            Não é possível salvar o lembrete. Escreva o título do evento.
          </small>
        )}
      </label>
      {reminder && (
        <button type="button" className="text-button danger" onClick={onRemove}>
          Concluir e remover lembrete
        </button>
      )}
      <fieldset className="reminder-schedule-field">
        <legend>O evento acontecerá em?</legend>
        <div className="reminder-schedule-options" role="group">
          <button
            type="button"
            className={
              !spansMultipleDays
                ? 'reminder-schedule-option selected'
                : 'reminder-schedule-option'
            }
            aria-pressed={!spansMultipleDays}
            onClick={() => {
              setSpansMultipleDays(false)
              setEndDate(date)
              if (occurrence === 'daily-times') setOccurrence('all-day')
            }}
          >
            Dia específico
          </button>
          <button
            type="button"
            className={
              spansMultipleDays
                ? 'reminder-schedule-option selected'
                : 'reminder-schedule-option'
            }
            aria-pressed={spansMultipleDays}
            onClick={() => {
              setSpansMultipleDays(true)
              if (occurrence === 'single-time') setOccurrence('all-day')
            }}
          >
            Vários dias
          </button>
        </div>
      </fieldset>
      <CalendarPicker
        label={spansMultipleDays ? 'Data de início' : 'Qual dia?'}
        value={date}
        onChange={changeStartDate}
      />
      {spansMultipleDays && (
        <CalendarPicker
          label="Data de término"
          value={endDate}
          onChange={setEndDate}
        />
      )}
      <fieldset className="reminder-schedule-field">
        <legend>
          {spansMultipleDays
            ? 'Como acontece nesse período?'
            : 'Em que momento o evento ocorre?'}
        </legend>
        <div className="reminder-schedule-options three-options" role="group">
          <button
            type="button"
            className={
              occurrence === 'all-day'
                ? 'reminder-schedule-option selected'
                : 'reminder-schedule-option'
            }
            aria-pressed={occurrence === 'all-day'}
            onClick={() => setOccurrence('all-day')}
          >
            Dia todo
          </button>
          <button
            type="button"
            className={
              occurrence === 'continuous'
                ? 'reminder-schedule-option selected'
                : 'reminder-schedule-option'
            }
            aria-pressed={occurrence === 'continuous'}
            onClick={() => setOccurrence('continuous')}
          >
            {spansMultipleDays ? 'Contínuo' : 'Com duração'}
          </button>
          {!spansMultipleDays && (
            <button
              type="button"
              className={
                occurrence === 'single-time'
                  ? 'reminder-schedule-option selected'
                  : 'reminder-schedule-option'
              }
              aria-pressed={occurrence === 'single-time'}
              onClick={() => setOccurrence('single-time')}
            >
              Um horário
            </button>
          )}
          {spansMultipleDays && (
            <button
              type="button"
              className={
                occurrence === 'daily-times'
                  ? 'reminder-schedule-option selected'
                  : 'reminder-schedule-option'
              }
              aria-pressed={occurrence === 'daily-times'}
              onClick={() => setOccurrence('daily-times')}
            >
              Horários programados
            </button>
          )}
        </div>
      </fieldset>
      {occurrence === 'continuous' && (
        <div className="reminder-time-range">
          <TimePicker
            id="continuous-start"
            label="Horário de início"
            value={startTime}
            hourFormat={hourFormat}
            onChange={setStartTime}
            activeId={activeTimePickerId}
            onActiveChange={setActiveTimePickerId}
          />
          <TimePicker
            id="continuous-end"
            label="Horário de término"
            value={endTime}
            hourFormat={hourFormat}
            onChange={setEndTime}
            activeId={activeTimePickerId}
            onActiveChange={setActiveTimePickerId}
          />
        </div>
      )}
      {occurrence === 'single-time' && !spansMultipleDays && (
        <TimePicker
          id="single-time"
          label="Horário do aviso"
          value={startTime}
          hourFormat={hourFormat}
          onChange={setStartTime}
          activeId={activeTimePickerId}
          onActiveChange={setActiveTimePickerId}
        />
      )}
      {occurrence === 'daily-times' && spansMultipleDays && (
        <fieldset className="repeat-times-field">
          <legend>Horários programados</legend>
          <p className="muted">
            Adicione cada horário em que o evento deve ser lembrado.
          </p>
          <div className="repeat-times-list">
            {repeatTimes.map((time, index) => (
              <div className="repeat-time" key={`${time}-${index}`}>
                <TimePicker
                  id={`repeat-${index}`}
                  label={`Horário ${index + 1}`}
                  value={time}
                  hourFormat={hourFormat}
                  onChange={(nextTime) => {
                    if (
                      repeatTimes.some(
                        (current, currentIndex) =>
                          currentIndex !== index && current === nextTime,
                      )
                    )
                      return
                    setRepeatTimes((times) =>
                      times.map((current, currentIndex) =>
                        currentIndex === index ? nextTime : current,
                      ),
                    )
                  }}
                  activeId={activeTimePickerId}
                  onActiveChange={setActiveTimePickerId}
                />
                <button
                  type="button"
                  aria-label={`Remover horário ${time}`}
                  onClick={() => {
                    setActiveTimePickerId(null)
                    setRepeatTimes((times) =>
                      times.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
          <div className="add-repeat-time">
            <TimePicker
              id="new-repeat-time"
              label="Novo horário"
              value={timeToAdd}
              hourFormat={hourFormat}
              onChange={setTimeToAdd}
              activeId={activeTimePickerId}
              onActiveChange={setActiveTimePickerId}
            />
            <button
              type="button"
              onClick={() => {
                if (!repeatTimes.includes(timeToAdd)) {
                  setRepeatTimes((times) => [...times, timeToAdd])
                  setShowDuplicateTimeWarning(false)
                } else setShowDuplicateTimeWarning(true)
              }}
            >
              + Adicionar horário
            </button>
          </div>
          {showDuplicateTimeWarning && (
            <p className="schedule-hint" role="alert">
              Não é possível colocar 2 horários iguais como alarmes.
            </p>
          )}
        </fieldset>
      )}
      {invalidDateRange && (
        <p className="range-warning" role="alert">
          A data de término precisa ser igual ou posterior à data de início.
        </p>
      )}
      {invalidTimeRange && !invalidDateRange && (
        <p className="range-warning" role="alert">
          O horário de término precisa ser posterior ao início no mesmo dia.
        </p>
      )}
      {invalidRepeatTimes && (
        <p className="range-warning" role="alert">
          Adicione pelo menos um horário para continuar.
        </p>
      )}
      <p className="muted">
        O contador escolhe automaticamente a melhor unidade de tempo.
      </p>
      <button className="primary-button" type="submit">
        Salvar lembrete
      </button>
    </form>
  )
}
