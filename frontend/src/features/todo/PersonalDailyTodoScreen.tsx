import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  AppDatePicker,
  AppSelect,
} from '../../components/controls'
import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'
import {
  mementoApi,
  MementoApiError,
  type MementoRecord,
} from '../../services/mementoApi'

import './PersonalDailyTodoScreen.css'

type CompletionFilter = 'all' | 'open' | 'completed'
type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent'

interface PersonalDailyTodoItem {
  id: string
  description: string
  completed: boolean
  priority: PriorityLevel
  startTime: string | null
  dueDate: string
  modified: string
}

interface PersonalDailyTodoScreenProps {
  onBack?: () => void
}

const PRIORITY_OPTIONS: PriorityLevel[] = ['Low', 'Medium', 'High', 'Urgent']

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateHeading(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatDueDateLabel(value: string): string {
  if (!value) return ''
  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (typeof DOMParser === 'undefined') return value.trim()

  const parsed = new DOMParser().parseFromString(value, 'text/html')
  return (parsed.body.textContent ?? value).replace(/\s+/g, ' ').trim()
}

function normalizePriority(value: unknown): PriorityLevel {
  const str = String(value ?? '').trim()
  if (str === 'Low' || str === 'Medium' || str === 'High' || str === 'Urgent') {
    return str
  }
  return 'Medium'
}

export function PersonalDailyTodoScreen({ onBack }: PersonalDailyTodoScreenProps) {
  const todayKey = useMemo(() => localDateKey(new Date()), [])

  const [items, setItems] = useState<PersonalDailyTodoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Bottom Composer state
  const [draftDescription, setDraftDescription] = useState('')
  const [draftPriority, setDraftPriority] = useState<PriorityLevel>('Medium')
  const [draftDueDate, setDraftDueDate] = useState<string>(todayKey)
  const [isCreating, setIsCreating] = useState(false)

  // Modify Dialog state
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!editingId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingId])

  const loadDailyTodos = useCallback(async () => {
    try {
      const response = await mementoApi.getDocTypeRecords({
        doctype: 'Daily ToDo',
        start: 0,
        page_length: 100,
      })

      const mapped: PersonalDailyTodoItem[] = response.data.map((record: MementoRecord) => {
        const rawDate = typeof record.date === 'string' ? record.date.slice(0, 10) : ''
        const rawStart =
          typeof record.start_time === 'string' && record.start_time
            ? record.start_time
            : null

        return {
          id: record.name,
          description: stripHtml(record.description) || record.name,
          completed: Number(record.status) === 1,
          priority: normalizePriority(record.priority),
          startTime: rawStart,
          dueDate: rawDate,
          modified: typeof record.modified === 'string' ? record.modified : '',
        }
      })

      setItems(mapped)
      setStatusMessage(null)
    } catch (error) {
      setStatusMessage(
        error instanceof MementoApiError
          ? error.message
          : 'Unable to load Daily To-Do items from ERPNext.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDailyTodos()
  }, [loadDailyTodos])

  const dateAndPriorityScoped = useMemo(() => {
    return items.filter((item) => {
      const matchesDate = !selectedDate || item.dueDate === selectedDate
      const matchesPriority =
        priorityFilter === 'all' || item.priority === priorityFilter
      return matchesDate && matchesPriority
    })
  }, [items, selectedDate, priorityFilter])

  const visibleItems = useMemo(() => {
    const filtered = dateAndPriorityScoped.filter((item) => {
      if (completionFilter === 'open') return !item.completed
      if (completionFilter === 'completed') return item.completed
      return true
    })

    const priorityWeight: Record<PriorityLevel, number> = {
      Urgent: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    }

    return [...filtered].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return priorityWeight[a.priority] - priorityWeight[b.priority]
      }
      return b.modified.localeCompare(a.modified)
    })
  }, [dateAndPriorityScoped, completionFilter])

  const totalInView = dateAndPriorityScoped.length
  const completedCount = dateAndPriorityScoped.filter((i) => i.completed).length
  const openCount = totalInView - completedCount
  const completionPercent =
    totalInView > 0 ? Math.round((completedCount / totalInView) * 100) : 0

  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanText = draftDescription.trim()
    if (!cleanText || isCreating) return

    setIsCreating(true)
    setStatusMessage(null)

    const nowStamp = new Date().toISOString().slice(0, 19).replace('T', ' ')

    try {
      await mementoApi.createDocTypeRecord('Daily ToDo', {
        description: cleanText,
        status: 0,
        priority: draftPriority,
        start_time: nowStamp,
        ...(draftDueDate ? { date: draftDueDate } : {}),
      })
      setDraftDescription('')
      await loadDailyTodos()
    } catch (error) {
      setStatusMessage(
        error instanceof MementoApiError
          ? error.message
          : 'Could not create Daily To-Do item.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function toggleCompleted(id: string, completed: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed } : item,
      ),
    )

    try {
      await mementoApi.updateDocTypeRecord('Daily ToDo', id, {
        status: completed ? 1 : 0,
      })
      await loadDailyTodos()
    } catch {
      setStatusMessage('Could not update item status in ERPNext.')
      await loadDailyTodos()
    }
  }

  return (
    <main className="daily-intent-screen" aria-labelledby="daily-intent-heading">
      <header className="daily-intent-header">
        <div className="daily-intent-header__copy">
          {onBack && (
            <button type="button" className="daily-intent-back" onClick={onBack}>
              <i className="ri-arrow-left-line" aria-hidden="true" />
              Back to overview
            </button>
          )}
          <span className="daily-intent-eyebrow">MEMENTO / DAILY INTENTIONS</span>
          <h1 id="daily-intent-heading">Daily To-Do</h1>
        </div>

        <div className="daily-intent-header__date">
          <span>TODAY</span>
          <strong>{formatDateHeading(new Date())}</strong>
        </div>
      </header>

      <div className="daily-intent-layout">
        {/* LEFT 70%: Checklist Feed + Bottom Composer */}
        <section className="daily-intent-main" aria-label="Daily intentions list">
          <div className="daily-intent-feed-meta">
            <p>
              {selectedDate ? `Due ${formatDueDateLabel(selectedDate)}` : 'All due dates'}
              {' · '}
              {totalInView} intention{totalInView === 1 ? '' : 's'}
            </p>
            <span className="daily-intent-pill">Personal Checklist</span>
          </div>

          <div className="daily-intent-scroll" aria-label="Daily to-do items">
            {isLoading ? (
              <div className="daily-intent-empty">
                <p>Loading your daily intentions…</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="daily-intent-empty">
                <span className="daily-intent-empty__icon" aria-hidden="true">
                  <i className="ri-sun-line" />
                </span>
                <h3>
                  {completionFilter === 'completed'
                    ? 'No completed items yet'
                    : completionFilter === 'open'
                      ? 'Nothing pending—all clear!'
                      : 'Set your intentions for today'}
                </h3>
                <p>Add a daily to-do below with a priority and due date.</p>
              </div>
            ) : (
              <div className="daily-intent-items">
                {visibleItems.map((item) => {
                  const isOverdue =
                    !item.completed && Boolean(item.dueDate) && item.dueDate < todayKey

                  return (
                    <article
                      key={item.id}
                      className={`daily-intent-item${item.completed ? ' is-completed' : ''}`}
                    >
                      <div className="daily-intent-item__content">
                        <h3>{item.description}</h3>

                        <div className="daily-intent-item__meta">
                          <span
                            className={`daily-intent-badge daily-intent-badge--priority is-${item.priority.toLowerCase()}`}
                          >
                            <i className="ri-flag-2-line" aria-hidden="true" />
                            {item.priority}
                          </span>

                          {item.dueDate && (
                            <span
                              className={`daily-intent-badge${isOverdue ? ' is-overdue' : ''}`}
                            >
                              <i className="ri-calendar-event-line" aria-hidden="true" />
                              {isOverdue ? 'Overdue · ' : 'Due '}
                              {formatDueDateLabel(item.dueDate)}
                            </span>
                          )}

                          {item.startTime && (
                            <span className="daily-intent-badge">
                              <i className="ri-time-line" aria-hidden="true" />
                              Started {formatDateTime(item.startTime)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="daily-intent-item__actions">
                        <label
                          className="daily-intent-check"
                          aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.description}`}
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={(event) =>
                              void toggleCompleted(item.id, event.target.checked)
                            }
                          />
                          <span aria-hidden="true">
                            <i className="ri-check-line" />
                          </span>
                        </label>

                        <button
                          type="button"
                          className="daily-intent-edit-btn"
                          onClick={() => setEditingId(item.id)}
                          aria-label={`Modify ${item.description}`}
                        >
                          <i className="ri-edit-line" aria-hidden="true" />
                          <span>Modify</span>
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom Composer Card */}
          <form className="daily-intent-composer" onSubmit={handleCreateSubmit}>
            <div className="daily-intent-composer__top">
              <h2>Add Daily Intention</h2>
              <span>Enter to add · Shift+Enter for new line</span>
            </div>

            <div className="daily-intent-composer__body">
              <textarea
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="What do you want to accomplish today?"
                rows={2}
                disabled={isCreating}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />

              <div className="daily-intent-composer__controls">
                <div className="daily-intent-composer__meta-inputs">
                  <AppSelect
                    id="daily-composer-priority"
                    label="Priority"
                    value={draftPriority}
                    onChange={(val) => setDraftPriority(normalizePriority(val))}
                    options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))}
                  />

                  <AppDatePicker
                    id="daily-composer-due-date"
                    label="Due Date"
                    value={draftDueDate}
                    onChange={setDraftDueDate}
                    placeholder="Select due date"
                    clearable
                  />
                </div>

                <button
                  type="submit"
                  className="daily-intent-composer__submit"
                  disabled={!draftDescription.trim() || isCreating}
                >
                  <i className="ri-add-line" aria-hidden="true" />
                  {isCreating ? 'Adding…' : 'Add Intention'}
                </button>
              </div>
            </div>

            {statusMessage && (
              <p className="daily-intent-composer__note" role="status">
                {statusMessage}
              </p>
            )}
          </form>
        </section>

        {/* RIGHT 30%: Progress Tracker & Filters */}
        <aside className="daily-intent-sidebar" aria-label="Daily progress and filters">
          <section className="daily-intent-card">
            <span className="daily-intent-eyebrow">DAILY MOMENTUM</span>
            <h2>Progress Overview</h2>

            <div className="daily-progress-box">
              <div className="daily-progress-box__labels">
                <strong>{completionPercent}% completed</strong>
                <span>
                  {completedCount} of {totalInView} done
                </span>
              </div>
              <div
                className="daily-progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionPercent}
              >
                <div
                  className="daily-progress-bar__fill"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <div className="daily-sidebar-divider" />

            <span className="daily-intent-eyebrow">REFINE VIEW</span>
            <h3>Filters</h3>

            <AppDatePicker
              className="daily-filter-field"
              id="daily-filter-date"
              label="Due Date"
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="All due dates"
              clearable
            />

            <div className="daily-quick-dates">
              <button
                type="button"
                aria-pressed={!selectedDate}
                onClick={() => setSelectedDate('')}
              >
                All dates
              </button>
              <button
                type="button"
                aria-pressed={selectedDate === todayKey}
                onClick={() => setSelectedDate(todayKey)}
              >
                Today
              </button>
            </div>

            <div className="daily-filter-group">
              <span className="daily-filter-label">STATUS</span>
              <div className="daily-filter-pills">
                {(
                  [
                    ['all', `All (${totalInView})`],
                    ['open', `To do (${openCount})`],
                    ['completed', `Done (${completedCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={completionFilter === key ? 'is-active' : ''}
                    onClick={() => setCompletionFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="daily-filter-group">
              <span className="daily-filter-label">PRIORITY</span>
              <div className="daily-filter-pills">
                {(['all', ...PRIORITY_OPTIONS] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={priorityFilter === level ? 'is-active' : ''}
                    onClick={() => setPriorityFilter(level)}
                  >
                    {level === 'all' ? 'All' : level}
                  </button>
                ))}
              </div>
            </div>

            <p className="daily-sync-note">
              <i className="ri-cloud-line" aria-hidden="true" />
              Personal Daily To-Dos sync with ERPNext.
            </p>
          </section>
        </aside>
      </div>

      {/* Modify Daily To-Do Dialog */}
      {editingId && (
        <div
          className="daily-edit-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditingId(null)
            }
          }}
        >
          <div
            className="daily-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-edit-modal-title"
          >
            <div className="daily-edit-modal__header">
              <div>
                <span className="daily-intent-eyebrow">UPDATE INTENTION</span>
                <h2 id="daily-edit-modal-title">Modify Daily To-Do</h2>
              </div>
              <button
                type="button"
                className="daily-edit-modal__close"
                onClick={() => setEditingId(null)}
                aria-label="Close dialog"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <MetadataDrivenForm
              key={`daily-update-${editingId}`}
              doctype="Daily ToDo"
              mode="update"
              recordName={editingId}
              allowedFieldnames={['description', 'priority', 'date']}
              submitText="Save Changes"
              showCancel
              onCancel={() => setEditingId(null)}
              onSuccess={() => {
                setEditingId(null)
                void loadDailyTodos()
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}