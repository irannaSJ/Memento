import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AppCombobox } from '../../components/controls'
import {
  mementoApi,
  MementoApiError,
  type MementoRecord,
  type TaskActivityComment,
  type TaskLogSummary,
} from '../../services/mementoApi'

import './TaskActivityLogScreen.css'

interface TaskActivityLogScreenProps {
  taskId?: string
  taskName?: string
  projectId?: string
  projectName?: string
  initialDate?: string
  onBack?: () => void
  onOpenTaskTodos?: (context: {
    taskId: string
    taskName: string
    projectId: string
    projectName: string
  }) => void
}

interface TaskChoice {
  id: string
  label: string
  projectId: string
  projectLabel: string
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() + days)
  return copy
}

function getWeekDays(anchorDate: Date): Date[] {
  const dayOfWeek = anchorDate.getDay() // 0 = Sun
  const sunday = addDays(anchorDate, -dayOfWeek)
  return Array.from({ length: 7 }, (_, idx) => addDays(sunday, idx))
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatSelectedPill(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return 'just now'
  const parsed = new Date(isoString.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return isoString

  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000))
  if (diffSeconds < 45) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function getText(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (typeof DOMParser === 'undefined') return value.trim()

  const parsed = new DOMParser().parseFromString(value, 'text/html')
  return (parsed.body.textContent ?? value).replace(/\s+/g, ' ').trim()
}

function getInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0].toUpperCase() : 'A'
}

export function TaskActivityLogScreen({
  taskId = '',
  taskName = '',
  projectId = '',
  projectName = '',
  initialDate,
  onBack,
  onOpenTaskTodos,
}: TaskActivityLogScreenProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(taskId)
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate || toLocalDateKey(new Date()),
  )
  const [tasks, setTasks] = useState<TaskChoice[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({})

  const [taskLog, setTaskLog] = useState<TaskLogSummary | null>(null)
  const [comments, setComments] = useState<TaskActivityComment[]>([])
  const [loggedDates, setLoggedDates] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [draftComment, setDraftComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const timelineEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (taskId) {
      setSelectedTaskId(taskId)
    }
  }, [taskId])

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate)
    }
  }, [initialDate])

  // Load Projects & Tasks for context display and task switching
  useEffect(() => {
    let cancelled = false

    async function loadReferenceData() {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          mementoApi.getDocTypeRecords({
            doctype: 'My Projects',
            start: 0,
            page_length: 100,
          }),
          mementoApi.getDocTypeRecords({
            doctype: 'Tasks',
            start: 0,
            page_length: 100,
          }),
        ])

        if (cancelled) return

        const projLookup: Record<string, string> = {}
        for (const p of projectsRes.data) {
          projLookup[p.name] = getText(p.project_name) || p.name
        }
        setProjectsMap(projLookup)

        const taskChoices: TaskChoice[] = tasksRes.data.map((t: MementoRecord) => {
          const pId = typeof t.project === 'string' ? t.project : ''
          return {
            id: t.name,
            label: getText(t.task_name) || t.name,
            projectId: pId,
            projectLabel: projLookup[pId] || pId,
          }
        })

        setTasks(taskChoices)

        if (!taskId && taskChoices.length > 0) {
          setSelectedTaskId((prev) => prev || taskChoices[0].id)
        }
      } catch {
        // Non-blocking: context labels fall back to passed props
      }
    }

    void loadReferenceData()
    return () => {
      cancelled = true
    }
  }, [taskId])

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  )

  const resolvedTaskName =
    activeTask?.label || (selectedTaskId === taskId ? taskName : '') || selectedTaskId
  const resolvedProjectId =
    activeTask?.projectId || (selectedTaskId === taskId ? projectId : '')
  const resolvedProjectName =
    activeTask?.projectLabel ||
    projectsMap[resolvedProjectId] ||
    (selectedTaskId === taskId ? projectName : '') ||
    resolvedProjectId

  const loadActivity = useCallback(async () => {
    if (!selectedTaskId || !selectedDate) {
      setTaskLog(null)
      setComments([])
      setLoggedDates([])
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await mementoApi.getTaskActivity(selectedTaskId, selectedDate)
      setTaskLog(response.data.task_log)
      setComments(response.data.comments)
      setLoggedDates(response.data.logged_dates)
    } catch (error) {
      const msg =
        error instanceof MementoApiError
          ? error.message
          : 'Unable to load activity logs from ERPNext.'
      setErrorMessage(msg)
      setTaskLog(null)
      setComments([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedTaskId, selectedDate])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  const weekDays = useMemo(
    () => getWeekDays(parseDateKey(selectedDate)),
    [selectedDate],
  )

  const loggedDateSet = useMemo(() => new Set(loggedDates), [loggedDates])

  const taskComboOptions = useMemo(
    () =>
      tasks.map((t) => ({
        value: t.id,
        label: t.label,
        description: t.projectLabel || undefined,
      })),
    [tasks],
  )

  async function handleSubmitComment(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = draftComment.trim()
    if (!trimmed || !selectedTaskId || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await mementoApi.addTaskActivityComment(
        selectedTaskId,
        selectedDate,
        trimmed,
      )
      setDraftComment('')
      setTaskLog(response.data.task_log)
      setComments((prev) => [...prev, response.data.comment])
      setLoggedDates((prev) =>
        prev.includes(selectedDate) ? prev : [...prev, selectedDate].sort(),
      )
      requestAnimationFrame(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    } catch (error) {
      setErrorMessage(
        error instanceof MementoApiError
          ? error.message
          : 'Failed to post comment.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEditing(comment: TaskActivityComment) {
    setOpenMenuId(null)
    setEditingCommentId(comment.name)
    setEditingDraft(comment.content)
  }

  async function saveEditedComment(commentName: string) {
    const trimmed = editingDraft.trim()
    if (!trimmed || isSavingEdit) return

    setIsSavingEdit(true)
    setErrorMessage(null)

    try {
      const response = await mementoApi.updateTaskActivityComment(commentName, trimmed)
      setComments((prev) =>
        prev.map((item) =>
          item.name === commentName ? response.data.comment : item,
        ),
      )
      setEditingCommentId(null)
      setEditingDraft('')
    } catch (error) {
      setErrorMessage(
        error instanceof MementoApiError
          ? error.message
          : 'Failed to update comment.',
      )
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDeleteComment(commentName: string) {
    setOpenMenuId(null)
    setErrorMessage(null)

    try {
      await mementoApi.deleteTaskActivityComment(commentName)
      setComments((prev) => prev.filter((item) => item.name !== commentName))
    } catch (error) {
      setErrorMessage(
        error instanceof MementoApiError
          ? error.message
          : 'Failed to delete comment.',
      )
    }
  }

  function shiftWeek(offsetDays: number) {
    const nextDate = addDays(parseDateKey(selectedDate), offsetDays)
    setSelectedDate(toLocalDateKey(nextDate))
  }

  return (
    <main className="activity-log-screen" aria-labelledby="activity-log-heading">
      <header className="activity-log-header">
        <div className="activity-log-header__left">
          {onBack && (
            <button type="button" className="activity-log-back" onClick={onBack}>
              <i className="ri-arrow-left-line" aria-hidden="true" />
              Back to tasks
            </button>
          )}
          <span className="activity-log-eyebrow">
            {resolvedProjectName || 'MEMENTO WORKSPACE'}
          </span>
          <h1 id="activity-log-heading">
            {resolvedTaskName || 'Task Activity Logs'}
          </h1>
        </div>

        {onOpenTaskTodos && selectedTaskId && (
          <button
            type="button"
            className="activity-log-todos-btn"
            onClick={() =>
              onOpenTaskTodos({
                taskId: selectedTaskId,
                taskName: resolvedTaskName,
                projectId: resolvedProjectId,
                projectName: resolvedProjectName,
              })
            }
          >
            <i className="ri-checkbox-multiple-line" aria-hidden="true" />
            Task To-Do
          </button>
        )}
      </header>

      <div className="activity-log-layout">
        {/* LEFT 70%: Comments & Activity Timeline + Bottom Comment Composer */}
        <section className="activity-log-main" aria-label="Task activity and comments">
          <div className="activity-log-feed-header">
            <h2>Activity &amp; Comments</h2>
            <span className="activity-log-log-badge">
              {taskLog ? taskLog.name : 'New log on first comment'}
            </span>
          </div>

          <div className="activity-log-timeline-scroll">
            {!selectedTaskId ? (
              <div className="activity-log-empty">
                <i className="ri-task-line" aria-hidden="true" />
                <h3>Select a task to view activity</h3>
                <p>Choose a task from the right panel to view or log daily updates.</p>
              </div>
            ) : isLoading ? (
              <div className="activity-log-empty">
                <p>Loading activity logs…</p>
              </div>
            ) : comments.length === 0 && !taskLog ? (
              <div className="activity-log-empty">
                <i className="ri-chat-3-line" aria-hidden="true" />
                <h3>No activity logged for {formatSelectedPill(selectedDate)}</h3>
                <p>
                  Write a comment below to log your progress for this task on this date.
                </p>
              </div>
            ) : (
              <div className="activity-timeline">
                {comments.map((comment) => {
                  const isEditing = editingCommentId === comment.name

                  return (
                    <div key={comment.name} className="activity-timeline__row">
                      <div className="activity-timeline__rail" aria-hidden="true">
                        <span className="activity-timeline__node">
                          <i className="ri-chat-1-line" />
                        </span>
                      </div>

                      <article className="activity-comment-card">
                        <div className="activity-comment-card__top">
                          <div className="activity-comment-card__author">
                            <span className="activity-avatar">
                              {getInitial(comment.author_name)}
                            </span>
                            <span className="activity-comment-card__meta">
                              <strong>
                                {comment.is_owner ? 'You' : comment.author_name}
                              </strong>{' '}
                              commented · {formatRelativeTime(comment.creation)}
                            </span>
                          </div>

                          {comment.is_owner && !isEditing && (
                            <div className="activity-comment-card__actions">
                              <button
                                type="button"
                                className="activity-comment-card__edit-btn"
                                onClick={() => startEditing(comment)}
                              >
                                Edit
                              </button>

                              <div className="activity-comment-card__menu-wrap">
                                <button
                                  type="button"
                                  className="activity-comment-card__more-btn"
                                  aria-label="More actions"
                                  onClick={() =>
                                    setOpenMenuId((prev) =>
                                      prev === comment.name ? null : comment.name,
                                    )
                                  }
                                >
                                  <i className="ri-more-fill" aria-hidden="true" />
                                </button>

                                {openMenuId === comment.name && (
                                  <div className="activity-comment-card__dropdown" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="is-danger"
                                      onClick={() => void handleDeleteComment(comment.name)}
                                    >
                                      <i className="ri-delete-bin-line" aria-hidden="true" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="activity-comment-card__body">
                          {isEditing ? (
                            <div className="activity-comment-edit">
                              <textarea
                                value={editingDraft}
                                onChange={(e) => setEditingDraft(e.target.value)}
                                rows={3}
                                autoFocus
                              />
                              <div className="activity-comment-edit__actions">
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    setEditingCommentId(null)
                                    setEditingDraft('')
                                  }}
                                  disabled={isSavingEdit}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => void saveEditedComment(comment.name)}
                                  disabled={isSavingEdit || !editingDraft.trim()}
                                >
                                  {isSavingEdit ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p>{comment.content}</p>
                          )}
                        </div>
                      </article>
                    </div>
                  )
                })}

                {taskLog && (
                  <>
                    <div className="activity-timeline__row activity-timeline__row--system">
                      <div className="activity-timeline__rail" aria-hidden="true">
                        <span className="activity-timeline__dot" />
                      </div>
                      <p className="activity-timeline__system-text">
                        <strong>You</strong> created this ·{' '}
                        {formatRelativeTime(taskLog.creation)}
                      </p>
                    </div>

                    <div className="activity-timeline__row activity-timeline__row--system">
                      <div className="activity-timeline__rail" aria-hidden="true">
                        <span className="activity-timeline__dot" />
                      </div>
                      <p className="activity-timeline__system-text">
                        <strong>You</strong> last edited this ·{' '}
                        {formatRelativeTime(taskLog.modified)}
                      </p>
                    </div>
                  </>
                )}

                <div ref={timelineEndRef} />
              </div>
            )}
          </div>

          {/* Bottom-Anchored Comment Composer */}
          <form className="activity-composer" onSubmit={handleSubmitComment}>
            {errorMessage && (
              <p className="activity-composer__error" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="activity-composer__bar">
              <span className="activity-avatar activity-avatar--composer" aria-hidden="true">
                A
              </span>

              <textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder={
                  selectedTaskId
                    ? 'Type a reply / comment (Enter to post, Shift+Enter for new line)'
                    : 'Select a task first to add a comment'
                }
                rows={2}
                disabled={!selectedTaskId || isSubmitting}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />

              <button
                type="submit"
                className="activity-composer__submit"
                disabled={!selectedTaskId || !draftComment.trim() || isSubmitting}
              >
                {isSubmitting ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </form>
        </section>

        {/* RIGHT 30%: Curved Weekly Date Selector + Task Context */}
        <aside className="activity-log-sidebar" aria-label="Date and task selector">
          <section className="activity-calendar-card">
            <div className="activity-arc-calendar" role="group" aria-label="Select date">
              <div className="activity-arc-calendar__arc" aria-hidden="true" />

              <div className="activity-arc-calendar__days">
                {weekDays.map((dayObj, index) => {
                  const key = toLocalDateKey(dayObj)
                  const isSelected = key === selectedDate
                  const hasLog = loggedDateSet.has(key)
                  // Parabolic vertical offset matching the curved week arc
                  const distanceFromCenter = Math.abs(index - 3)
                  const offsetPx = distanceFromCenter * distanceFromCenter * 3.5

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`activity-arc-day${isSelected ? ' is-selected' : ''}${hasLog ? ' has-log' : ''}`}
                      style={{ transform: `translateY(${offsetPx}px)` }}
                      onClick={() => setSelectedDate(key)}
                      aria-pressed={isSelected}
                    >
                      <span className="activity-arc-day__weekday">
                        {WEEKDAY_SHORT[dayObj.getDay()]}
                      </span>
                      <span className="activity-arc-day__num">{dayObj.getDate()}</span>
                      {hasLog && <span className="activity-arc-day__dot" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              <div className="activity-arc-calendar__nav">
                <button
                  type="button"
                  onClick={() => shiftWeek(-7)}
                  aria-label="Previous week"
                >
                  <i className="ri-arrow-left-s-line" aria-hidden="true" />
                </button>
                <strong>{formatMonthYear(parseDateKey(selectedDate))}</strong>
                <button
                  type="button"
                  onClick={() => shiftWeek(7)}
                  aria-label="Next week"
                >
                  <i className="ri-arrow-right-s-line" aria-hidden="true" />
                </button>
              </div>

              <div className="activity-arc-calendar__selected">
                <span>Selected:</span>
                <span className="activity-arc-calendar__pill">
                  {formatSelectedPill(selectedDate)}
                </span>
              </div>
            </div>

            <div className="activity-sidebar-divider" />

            <div className="activity-context-details">
              <span className="activity-log-eyebrow">CURRENT CONTEXT</span>

              <div className="activity-context-row">
                <span>
                  <i className="ri-folder-3-line" aria-hidden="true" /> PROJECT
                </span>
                <strong>{resolvedProjectName || 'No project linked'}</strong>
              </div>

              <div className="activity-context-row">
                <span>
                  <i className="ri-task-line" aria-hidden="true" /> TASK
                </span>
                <strong>{resolvedTaskName || 'Select a task'}</strong>
              </div>

              {tasks.length > 0 && (
                <AppCombobox
                  className="activity-task-switcher"
                  id="activity-log-task-select"
                  label="Switch Task"
                  value={selectedTaskId}
                  onChange={(val) => setSelectedTaskId(val)}
                  options={taskComboOptions}
                  placeholder="Search tasks..."
                  clearable={false}
                />
              )}

              <p className="activity-sync-note">
                <i className="ri-cloud-line" aria-hidden="true" />
                Comments and Task To-Dos sync directly to ERPNext Task Log.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}