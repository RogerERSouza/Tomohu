import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CalendarPicker } from './components/CalendarPicker'
import { ContentCard } from './components/ContentCard'
import { ContentEditor } from './components/ContentEditor'
import { GlobalSearchResults } from './components/GlobalSearchResults'
import { Icon } from './components/Icon'
import { Modal } from './components/Modal'
import { SectionCard } from './components/SectionCard'
import { TimePicker } from './components/TimePicker'
import { useNotebook } from './hooks/useNotebook'
import {
  CONTENT_LABELS,
  createContent,
  getCounterTotal,
  getSectionPath,
  parseNotebookBackup,
  removeContent,
  removeSectionTree,
  SECTION_COLORS,
} from './lib/notebook'
import {
  formatReminderCountdown,
  formatReminderDate,
  getDateInputValue,
  getReminderDate,
  isReminderExpired,
  getReminderPriority,
} from './lib/reminders'
import type { ReminderDraft } from './lib/reminders'
import type { HourFormat } from './lib/time'
import { searchNotebook } from './lib/search'
import type { Content, ContentKind, Notebook, Reminder, Section } from './types'
import './App.css'

type Editor =
  | { kind: 'section'; section?: Section }
  | { kind: 'content' }
  | { kind: 'settings' }
  | { kind: 'reminder'; reminder?: Reminder }
  | { kind: 'expired-reminder'; reminder: Reminder }
  | { kind: 'import-backup'; backup: Notebook; fileName: string }
  | null

type Theme = 'dark' | 'light'
const THEME_STORAGE_KEY = 'tomohu.theme'
const HOUR_FORMAT_STORAGE_KEY = 'tomohu.hour-format'

function getSavedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

function getSavedHourFormat(): HourFormat {
  try {
    return localStorage.getItem(HOUR_FORMAT_STORAGE_KEY) === '12h'
      ? '12h'
      : '24h'
  } catch {
    return '24h'
  }
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
function getHash() {
  return window.location.hash
}
function navigate(kind?: 'section' | 'content', id?: string) {
  const updateRoute = () => {
    window.location.hash = kind && id ? `${kind}/${id}` : ''
  }
  const documentWithTransitions = document as Document & {
    startViewTransition?: (callback: () => void) => void
  }
  if (documentWithTransitions.startViewTransition)
    documentWithTransitions.startViewTransition(updateRoute)
  else updateRoute()
}

function getContentColumns(contents: Content[], isCompactLayout: boolean) {
  if (isCompactLayout) return [contents]
  return [
    contents.filter((_, index) => index % 2 === 0),
    contents.filter((_, index) => index % 2 === 1),
  ]
}

function SectionForm({
  section,
  onSave,
  onRemove,
}: {
  section?: Section
  onSave: (values: Pick<Section, 'title' | 'emoji' | 'color' | 'tags'>) => void
  onRemove?: () => void
}) {
  const [title, setTitle] = useState(section?.title ?? '')
  const [hasTriedToSave, setHasTriedToSave] = useState(false)
  const [emoji, setEmoji] = useState(section?.emoji ?? '📁')
  const [color, setColor] = useState(section?.color ?? SECTION_COLORS[0])
  const [tags, setTags] = useState(section?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false)
  return (
    <form
      className="modal-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setHasTriedToSave(true)
        if (!title.trim()) return
        onSave({ title: title.trim(), emoji: emoji.trim(), color, tags })
      }}
    >
      <label className="field">
        <span>Nome da seção</span>
        <input
          required
          maxLength={80}
          placeholder="Ex.: Coisas para aprender"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {hasTriedToSave && !title.trim() && (
          <small className="form-warning" role="alert">
            Não é possível salvar a seção. Escreva o nome da seção.
          </small>
        )}
      </label>
      <label className="field">
        <span>
          Emoji <small>(opcional)</small>
        </span>
        <input
          maxLength={12}
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
        />
      </label>
      <fieldset className="color-field">
        <legend>Cor de destaque</legend>
        <div
          className="color-options"
          role="radiogroup"
          aria-label="Cores sugeridas"
        >
          {SECTION_COLORS.map((option, index) => (
            <label
              key={option}
              className="color-option"
              style={{ background: option }}
            >
              <input
                type="radio"
                name="color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                aria-label={
                  ['Azul', 'Lilás', 'Verde', 'Amarelo', 'Rosa'][index]
                }
              />
              <span aria-hidden="true">{color === option ? '✓' : ''}</span>
            </label>
          ))}
          <label className="color-picker" title="Escolher outra cor">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Escolher outra cor"
            />
            <span aria-hidden="true">+</span>
          </label>
        </div>
        <span className="color-value" aria-live="polite">
          Cor atual: {color.toUpperCase()}
        </span>
      </fieldset>
      <fieldset className="tag-field">
        <legend>
          Tags <small>(opcional)</small>
        </legend>
        <div className="tag-input-row">
          <input
            maxLength={24}
            placeholder="Ex.: escola"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              const tag = tagInput
                .trim()
                .replace(/^#/, '')
                .toLocaleLowerCase('pt-BR')
              if (tag && !tags.includes(tag))
                setTags((current) => [...current, tag])
              setTagInput('')
            }}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const tag = tagInput
                .trim()
                .replace(/^#/, '')
                .toLocaleLowerCase('pt-BR')
              if (tag && !tags.includes(tag))
                setTags((current) => [...current, tag])
              setTagInput('')
            }}
          >
            Adicionar
          </button>
        </div>
        {tags.length > 0 && (
          <div className="tag-list" aria-label="Tags da seção">
            {tags.map((tag) => (
              <button
                type="button"
                className="tag-chip"
                key={tag}
                onClick={() =>
                  setTags((current) => current.filter((item) => item !== tag))
                }
                aria-label={`Remover tag ${tag}`}
              >
                #{tag} ×
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <button className="primary-button" type="submit">
        {section ? 'Salvar alterações' : 'Criar seção'}
      </button>
      {section && onRemove && (
        <div className="section-delete">
          {isDeleteConfirmationVisible ? (
            <>
              <p className="form-warning" role="alert">
                Esta seção, suas subseções e todos os conteúdos internos serão
                apagados permanentemente.
              </p>
              <div className="section-delete-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsDeleteConfirmationVisible(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={onRemove}
                >
                  <Icon name="trash" />
                  Excluir seção
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setIsDeleteConfirmationVisible(true)}
            >
              <Icon name="trash" />
              Excluir seção
            </button>
          )}
        </div>
      )}
    </form>
  )
}

function ContentForm({
  onSave,
}: {
  onSave: (kind: ContentKind, title: string) => void
}) {
  const [title, setTitle] = useState('')
  const [hasTriedToSave, setHasTriedToSave] = useState(false)
  const [kind, setKind] = useState<ContentKind>('note')
  return (
    <form
      className="modal-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setHasTriedToSave(true)
        if (!title.trim()) return
        onSave(kind, title.trim())
      }}
    >
      <label className="field">
        <span>Título</span>
        <input
          required
          maxLength={100}
          placeholder="O que você quer registrar?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {hasTriedToSave && !title.trim() && (
          <small className="form-warning" role="alert">
            Não é possível criar o conteúdo. Escreva o título.
          </small>
        )}
      </label>
      <fieldset className="type-field">
        <legend>Tipo de conteúdo</legend>
        <div className="type-options">
          {(Object.keys(CONTENT_LABELS) as ContentKind[]).map((option) => (
            <label
              className={
                kind === option ? 'type-option selected' : 'type-option'
              }
              key={option}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              <Icon name={option} />
              {CONTENT_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="primary-button" type="submit">
        Criar e abrir
      </button>
    </form>
  )
}

function getTimeOneHourLater(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function ReminderForm({
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

function App() {
  const { notebook, setNotebook, replaceNotebook, storageError } = useNotebook()
  const hash = useSyncExternalStore(subscribeToHash, getHash)
  const [routeKind, routeId] = hash.slice(1).split('/')
  const currentContent =
    routeKind === 'content'
      ? notebook.contents.find((content) => content.id === routeId)
      : undefined
  const currentSection = notebook.sections.find(
    (section) =>
      section.id ===
      (currentContent?.sectionId ?? (routeKind === 'section' ? routeId : null)),
  )
  const isHome = !hash || hash === '#'
  const isMissing = !isHome && !currentSection
  const path = getSectionPath(notebook.sections, currentSection?.id ?? null)
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const [theme, setTheme] = useState<Theme>(getSavedTheme)
  const [hourFormat, setHourFormat] = useState<HourFormat>(getSavedHourFormat)
  const [importError, setImportError] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const [isCompactContentLayout, setIsCompactContentLayout] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  )
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme preference is optional when browser storage is unavailable.
    }
  }, [theme])
  useEffect(() => {
    try {
      localStorage.setItem(HOUR_FORMAT_STORAGE_KEY, hourFormat)
    } catch {
      // Hour format preference is optional when browser storage is unavailable.
    }
  }, [hourFormat])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateContentLayout = () => setIsCompactContentLayout(media.matches)
    media.addEventListener('change', updateContentLayout)
    return () => media.removeEventListener('change', updateContentLayout)
  }, [])
  useEffect(() => {
    if (!isSortMenuOpen) return
    const closeMenu = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node))
        setIsSortMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [isSortMenuOpen])
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const isGlobalSearchActive = isHome && Boolean(normalizedQuery)
  const parentId = currentSection?.id ?? null
  const sectionsInScope = notebook.sections.filter(
    (section) =>
      (isHome && normalizedQuery ? true : section.parentId === parentId) &&
      section.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  )
  const usedColors = [
    ...new Set(sectionsInScope.map((section) => section.color)),
  ]
  const usedTags = [
    ...new Set(sectionsInScope.flatMap((section) => section.tags ?? [])),
  ].sort((first, second) => first.localeCompare(second, 'pt-BR'))
  const visibleSections = notebook.sections.filter(
    (section) =>
      (isHome && normalizedQuery ? true : section.parentId === parentId) &&
      section.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery) &&
      (!colorFilter || section.color === colorFilter) &&
      (!tagFilter || section.tags?.includes(tagFilter)),
  )
  if (sortOrder === 'newest') visibleSections.reverse()
  if (sortOrder === 'alphabetical')
    visibleSections.sort((first, second) =>
      first.title.localeCompare(second.title, 'pt-BR'),
    )
  visibleSections.sort(
    (first, second) =>
      Number(Boolean(second.favorite)) - Number(Boolean(first.favorite)),
  )
  const visibleContents = notebook.contents.filter(
    (content) =>
      content.sectionId === currentSection?.id &&
      !colorFilter &&
      content.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  )
  const contentColumns = getContentColumns(
    visibleContents,
    isCompactContentLayout,
  )
  const globalSearchResults = isGlobalSearchActive
    ? searchNotebook(notebook, query)
    : []
  const reminders = [...notebook.reminders].sort(
    (first, second) =>
      getReminderPriority(first, now) - getReminderPriority(second, now),
  )

  function openSection(id?: string) {
    setQuery('')
    setColorFilter(null)
    setTagFilter(null)
    setIsSortMenuOpen(false)
    navigate(id ? 'section' : undefined, id)
  }
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
  function exportNotebook() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(notebook, null, 2)], {
        type: 'application/json',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `tomohu-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const backup = parseNotebookBackup(await file.text())
      setImportError('')
      setEditor({ kind: 'import-backup', backup, fileName: file.name })
    } catch {
      setImportError(
        'Não foi possível importar esse arquivo. Escolha um backup JSON válido do Tomohu.',
      )
    }
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        {storageError && (
          <div className="storage-warning" role="alert">
            {storageError}
            <button className="text-button" onClick={exportNotebook}>
              Exportar cópia
            </button>
          </div>
        )}
        {!isHome && (
          <nav className="breadcrumb" aria-label="Localização">
            <button onClick={() => openSection()}>Início</button>
            {path.map((section) => (
              <span key={section.id}>
                <Icon name="chevron" />
                <button
                  onClick={() => openSection(section.id)}
                  aria-current={
                    !currentContent && currentSection?.id === section.id
                      ? 'page'
                      : undefined
                  }
                >
                  {section.title}
                </button>
              </span>
            ))}
            {currentContent && (
              <span>
                <Icon name="chevron" />
                <span aria-current="page">{currentContent.title}</span>
              </span>
            )}
          </nav>
        )}

        {isMissing ? (
          <section className="empty-state">
            <h1>Conteúdo não encontrado</h1>
            <p>Este endereço não está neste caderno.</p>
            <button className="primary-button" onClick={() => openSection()}>
              Voltar ao início
            </button>
          </section>
        ) : currentContent ? (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {CONTENT_LABELS[currentContent.kind]}
                </span>
                <h1>{currentContent.title || 'Sem título'}</h1>
              </div>
              <button
                className="secondary-button"
                onClick={() => openSection(currentContent.sectionId)}
              >
                <Icon name="back" />
                Voltar à seção
              </button>
            </div>
            <ContentEditor
              key={currentContent.id}
              content={currentContent}
              onChange={updateContent}
              onCount={(delta) => changeCount(currentContent.id, delta)}
              onRemove={() => {
                setNotebook((current) =>
                  removeContent(current, currentContent.id),
                )
                openSection(currentContent.sectionId)
              }}
              hourFormat={hourFormat}
            />
          </>
        ) : (
          <>
            {!isHome && (
              <div className="page-heading">
                <h1>
                  {currentSection?.emoji} {currentSection?.title}
                </h1>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setEditor({ kind: 'section', section: currentSection })
                  }
                >
                  <Icon name="more" />
                  Editar seção
                </button>
              </div>
            )}
            {isHome && (
              <section
                className="reminders-section"
                aria-labelledby="reminders-title"
              >
                <div className="subheading">
                  <h1 id="reminders-title">Lembretes</h1>
                  <button
                    className="text-button"
                    onClick={() => setEditor({ kind: 'reminder' })}
                  >
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
                        onClick={() => {
                          setEditor(
                            isReminderExpired(reminder, now)
                              ? { kind: 'expired-reminder', reminder }
                              : { kind: 'reminder', reminder },
                          )
                        }}
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
            )}
            <section aria-labelledby="sections-title" className="sections-area">
              <div className="subheading">
                <h2 id="sections-title">
                  {isGlobalSearchActive
                    ? 'Resultados da busca'
                    : isHome
                      ? 'Suas seções'
                      : 'Dentro desta seção'}
                  <span className="section-count">
                    {isGlobalSearchActive
                      ? globalSearchResults.length
                      : visibleSections.length + visibleContents.length}
                  </span>
                </h2>
              </div>
              <div className="toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label={
                      isHome
                        ? 'Pesquisar em todo o Tomohu'
                        : 'Pesquisar nesta seção'
                    }
                    placeholder={
                      isHome
                        ? 'Pesquisar em todo o Tomohu…'
                        : 'Pesquisar nesta seção…'
                    }
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {!isGlobalSearchActive && (
                  <div className="sort-menu" ref={sortMenuRef}>
                    <button
                      type="button"
                      className="sort-menu-trigger"
                      aria-expanded={isSortMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setIsSortMenuOpen((isOpen) => !isOpen)}
                    >
                      Ordenar{colorFilter || tagFilter ? ' e filtrar' : ''}
                      <Icon name="sort" />
                    </button>
                    {isSortMenuOpen && (
                      <div className="sort-menu-panel" role="menu">
                        <span className="sort-menu-label">Ordenar por</span>
                        <button
                          type="button"
                          className={
                            sortOrder === 'newest'
                              ? 'sort-option active'
                              : 'sort-option'
                          }
                          onClick={() => {
                            setSortOrder('newest')
                            setIsSortMenuOpen(false)
                          }}
                          aria-pressed={sortOrder === 'newest'}
                        >
                          Mais recentes
                        </button>
                        <button
                          type="button"
                          className={
                            sortOrder === 'oldest'
                              ? 'sort-option active'
                              : 'sort-option'
                          }
                          onClick={() => {
                            setSortOrder('oldest')
                            setIsSortMenuOpen(false)
                          }}
                          aria-pressed={sortOrder === 'oldest'}
                        >
                          Mais antigas
                        </button>
                        <button
                          type="button"
                          className={
                            sortOrder === 'alphabetical'
                              ? 'sort-option active'
                              : 'sort-option'
                          }
                          onClick={() => {
                            setSortOrder('alphabetical')
                            setIsSortMenuOpen(false)
                          }}
                          aria-pressed={sortOrder === 'alphabetical'}
                        >
                          A–Z
                        </button>
                        {usedColors.length > 0 && (
                          <>
                            <span className="sort-menu-label">
                              Filtrar por cor
                            </span>
                            <div className="sort-color-options" role="group">
                              <button
                                type="button"
                                className={
                                  colorFilter
                                    ? 'sort-color-clear'
                                    : 'sort-color-clear active'
                                }
                                onClick={() => {
                                  setColorFilter(null)
                                  setIsSortMenuOpen(false)
                                }}
                              >
                                Todas
                              </button>
                              {usedColors.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={
                                    colorFilter === color
                                      ? 'sort-color selected'
                                      : 'sort-color'
                                  }
                                  style={{ backgroundColor: color }}
                                  aria-label={`Filtrar pela cor ${color}`}
                                  aria-pressed={colorFilter === color}
                                  onClick={() => {
                                    setColorFilter(color)
                                    setIsSortMenuOpen(false)
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        {usedTags.length > 0 && (
                          <>
                            <span className="sort-menu-label">
                              Filtrar por tag
                            </span>
                            <div className="sort-tag-options" role="group">
                              <button
                                type="button"
                                className={
                                  tagFilter ? 'sort-tag' : 'sort-tag active'
                                }
                                onClick={() => {
                                  setTagFilter(null)
                                  setIsSortMenuOpen(false)
                                }}
                              >
                                Todas
                              </button>
                              {usedTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  className={
                                    tagFilter === tag
                                      ? 'sort-tag active'
                                      : 'sort-tag'
                                  }
                                  onClick={() => {
                                    setTagFilter(tag)
                                    setIsSortMenuOpen(false)
                                  }}
                                >
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className="primary-button"
                  onClick={() => setEditor({ kind: 'section' })}
                >
                  <Icon name="plus" />
                  <span>{isHome ? 'Nova seção' : 'Subseção'}</span>
                </button>
                {!isHome && (
                  <button
                    className="secondary-button"
                    onClick={() => setEditor({ kind: 'content' })}
                  >
                    <Icon name="plus" />
                    Conteúdo
                  </button>
                )}
              </div>
              {isGlobalSearchActive ? (
                <GlobalSearchResults
                  results={globalSearchResults}
                  onOpenSection={openSection}
                  onOpenContent={(id) => navigate('content', id)}
                  onOpenReminder={(id) => {
                    const reminder = notebook.reminders.find(
                      (current) => current.id === id,
                    )
                    if (reminder)
                      setEditor(
                        isReminderExpired(reminder, now)
                          ? { kind: 'expired-reminder', reminder }
                          : { kind: 'reminder', reminder },
                      )
                  }}
                />
              ) : (
                <>
                  <div className="section-grid">
                    {visibleSections.map((section) => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        count={
                          notebook.sections.filter(
                            (child) => child.parentId === section.id,
                          ).length +
                          notebook.contents.filter(
                            (content) => content.sectionId === section.id,
                          ).length
                        }
                        onOpen={() => openSection(section.id)}
                        onEdit={() => setEditor({ kind: 'section', section })}
                        onToggleFavorite={() =>
                          setNotebook((current) => ({
                            ...current,
                            sections: current.sections.map((currentSection) =>
                              currentSection.id === section.id
                                ? {
                                    ...currentSection,
                                    favorite: !currentSection.favorite,
                                  }
                                : currentSection,
                            ),
                          }))
                        }
                      />
                    ))}
                  </div>
                  {visibleContents.length > 0 && (
                    <div className="content-columns">
                      {contentColumns.map((column, index) => (
                        <div className="content-column" key={index}>
                          {column.map((content) => (
                            <ContentCard
                              key={content.id}
                              content={content}
                              onOpen={() => navigate('content', content.id)}
                              onCount={(delta) =>
                                changeCount(content.id, delta)
                              }
                              onChange={updateContent}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {!visibleSections.length && !visibleContents.length && (
                    <div className="empty-state">
                      <Icon name="note" />
                      <h3>
                        {normalizedQuery
                          ? 'Nenhum resultado por aqui'
                          : 'Seção vazia'}
                      </h3>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <button
          className={
            isHome && editor?.kind !== 'settings'
              ? 'bottom-nav-button active'
              : 'bottom-nav-button'
          }
          aria-current={
            isHome && editor?.kind !== 'settings' ? 'page' : undefined
          }
          onClick={() => {
            setEditor(null)
            openSection()
          }}
        >
          <Icon name="home" />
          <span>Início</span>
        </button>
        <button
          className={
            editor?.kind === 'settings'
              ? 'bottom-nav-button active'
              : 'bottom-nav-button'
          }
          aria-haspopup="dialog"
          aria-expanded={editor?.kind === 'settings'}
          onClick={() => setEditor({ kind: 'settings' })}
        >
          <Icon name="settings" />
          <span>Ajustes</span>
        </button>
      </nav>
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={chooseBackup}
      />
      {editor && (
        <Modal
          title={
            editor.kind === 'section'
              ? editor.section
                ? 'Editar seção'
                : 'Nova seção'
              : editor.kind === 'content'
                ? 'Novo conteúdo'
                : editor.kind === 'settings'
                  ? 'Ajustes'
                  : editor.kind === 'expired-reminder'
                    ? 'Prazo encerrado'
                    : editor.kind === 'import-backup'
                      ? 'Importar backup'
                      : editor.reminder
                        ? 'Editar lembrete'
                        : 'Novo lembrete'
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === 'settings' && (
            <div className="settings-panel">
              <fieldset className="theme-field">
                <legend>Tema</legend>
                <div
                  className="theme-options"
                  role="radiogroup"
                  aria-label="Tema do app"
                >
                  <button
                    type="button"
                    className={
                      theme === 'dark'
                        ? 'theme-option selected'
                        : 'theme-option'
                    }
                    aria-pressed={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  >
                    Escuro
                  </button>
                  <button
                    type="button"
                    className={
                      theme === 'light'
                        ? 'theme-option selected'
                        : 'theme-option'
                    }
                    aria-pressed={theme === 'light'}
                    onClick={() => setTheme('light')}
                  >
                    Claro
                  </button>
                </div>
              </fieldset>
              <fieldset className="theme-field">
                <legend>Formato de hora</legend>
                <div
                  className="theme-options"
                  role="radiogroup"
                  aria-label="Formato de hora"
                >
                  <button
                    type="button"
                    className={
                      hourFormat === '24h'
                        ? 'theme-option selected'
                        : 'theme-option'
                    }
                    aria-pressed={hourFormat === '24h'}
                    onClick={() => setHourFormat('24h')}
                  >
                    24 horas
                  </button>
                  <button
                    type="button"
                    className={
                      hourFormat === '12h'
                        ? 'theme-option selected'
                        : 'theme-option'
                    }
                    aria-pressed={hourFormat === '12h'}
                    onClick={() => setHourFormat('12h')}
                  >
                    12 horas (AM/PM)
                  </button>
                </div>
              </fieldset>
              <button className="secondary-button" onClick={exportNotebook}>
                <Icon name="download" />
                Exportar cópia dos dados
              </button>
              <button
                className="secondary-button"
                onClick={() => importInputRef.current?.click()}
              >
                Importar cópia dos dados
              </button>
              {importError && (
                <p className="form-warning" role="alert">
                  {importError}
                </p>
              )}
              <p className="muted">Os dados ficam neste navegador.</p>
              <span className="muted">Tomohu · v0.14.2</span>
            </div>
          )}
          {editor.kind === 'import-backup' && (
            <div className="import-backup-panel">
              <p>
                O backup <strong>{editor.fileName}</strong> está válido. Ao
                continuar, ele substituirá os dados atuais deste navegador.
              </p>
              <p className="muted">
                Exporte uma cópia atual antes de continuar, caso queira voltar
                atrás depois.
              </p>
              <button className="secondary-button" onClick={exportNotebook}>
                <Icon name="download" />
                Exportar cópia atual
              </button>
              <div className="import-backup-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditor({ kind: 'settings' })}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    if (replaceNotebook(editor.backup)) {
                      setEditor(null)
                      openSection()
                    }
                  }}
                >
                  Substituir dados
                </button>
              </div>
            </div>
          )}
          {editor.kind === 'section' && (
            <SectionForm
              section={editor.section}
              onSave={(values) => {
                const existing = editor.section
                setNotebook((current) => ({
                  ...current,
                  sections: existing
                    ? current.sections.map((section) =>
                        section.id === existing.id
                          ? { ...section, ...values }
                          : section,
                      )
                    : [
                        ...current.sections,
                        {
                          id: crypto.randomUUID(),
                          parentId,
                          favorite: false,
                          ...values,
                        },
                      ],
                }))
                setEditor(null)
              }}
              onRemove={() => {
                const section = editor.section
                if (!section) return
                setNotebook((current) => removeSectionTree(current, section.id))
                setEditor(null)
                openSection(section.parentId ?? undefined)
              }}
            />
          )}
          {editor.kind === 'content' && currentSection && (
            <ContentForm
              onSave={(kind, title) => {
                const content = createContent(kind, currentSection.id, title)
                setNotebook((current) => ({
                  ...current,
                  contents: [...current.contents, content],
                }))
                setEditor(null)
                navigate('content', content.id)
              }}
            />
          )}
          {editor.kind === 'reminder' && (
            <ReminderForm
              reminder={editor.reminder}
              hourFormat={hourFormat}
              onSave={(values) => {
                const existing = editor.reminder
                setNotebook((current) => ({
                  ...current,
                  reminders: existing
                    ? current.reminders.map((reminder) =>
                        reminder.id === existing.id
                          ? { id: reminder.id, ...values }
                          : reminder,
                      )
                    : [
                        ...current.reminders,
                        { id: crypto.randomUUID(), ...values },
                      ],
                }))
                setEditor(null)
              }}
              onRemove={() => {
                const id = editor.reminder?.id
                setNotebook((current) => ({
                  ...current,
                  reminders: current.reminders.filter(
                    (reminder) => reminder.id !== id,
                  ),
                }))
                setEditor(null)
              }}
            />
          )}
          {editor.kind === 'expired-reminder' && (
            <div className="expired-reminder-panel">
              <p>
                O prazo deste evento terminou. Deseja excluir ou alterar a data?
              </p>
              <div className="expired-reminder-actions">
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => {
                    const id = editor.reminder.id
                    setNotebook((current) => ({
                      ...current,
                      reminders: current.reminders.filter(
                        (reminder) => reminder.id !== id,
                      ),
                    }))
                    setEditor(null)
                  }}
                >
                  Excluir lembrete
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    setEditor({ kind: 'reminder', reminder: editor.reminder })
                  }
                >
                  Alterar data
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default App
