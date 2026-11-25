// import { useCallback, useEffect, useMemo, useState } from 'react'

// import {
//   mementoApi,
//   type MementoRecord,
// } from '../../services/mementoApi'
// import type {
//   DailyTodoProjectOption,
//   LocalDailyTodoItem,
// } from './dailyTodoTypes'

// import './DailyTodoScreen.css'

// import {
//   AppDatePicker,
//   AppCombobox,
// } from '../../components/controls'
// // Adjust this path if MetadataDrivenForm lives directly under '../../components/MetadataDrivenForm'
// import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'

// type TodoViewFilter = 'all' | 'open' | 'completed'

// interface DailyTodoScreenProps {
//   projects?: DailyTodoProjectOption[]
//   taskId?: string
//   taskName?: string
//   projectId?: string
//   projectName?: string
//   onBack?: () => void
// }

// interface DailyTodoTaskOption {
//   id: string
//   label: string
//   projectId: string
//   projectLabel: string
// }

// function formatDateTime(value: string): string {
//   const date = new Date(value)
//   if (Number.isNaN(date.getTime())) return 'Unknown time'

//   return new Intl.DateTimeFormat('en-IN', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//     hour: '2-digit',
//     minute: '2-digit',
//   }).format(date)
// }

// function formatDateHeading(date: Date): string {
//   return new Intl.DateTimeFormat('en-IN', {
//     weekday: 'long',
//     day: 'numeric',
//     month: 'long',
//     year: 'numeric',
//   }).format(date)
// }

// function localDateKey(date: Date): string {
//   const year = date.getFullYear()
//   const month = String(date.getMonth() + 1).padStart(2, '0')
//   const day = String(date.getDate()).padStart(2, '0')
//   return `${year}-${month}-${day}`
// }

// function formatSelectedDay(value: string): string {
//   if (!value) return 'All dates'
//   const [year, month, day] = value.split('-').map(Number)
//   return formatDateHeading(new Date(year, month - 1, day))
// }

// function getText(value: unknown): string {
//   if (typeof value !== 'string') return ''
//   if (typeof DOMParser === 'undefined') return value.trim()

//   const parsed = new DOMParser().parseFromString(value, 'text/html')
//   return (parsed.body.textContent ?? value).replace(/\s+/g, ' ').trim()
// }

// export function DailyTodoScreen({
//   projects: suppliedProjects,
//   taskId = '',
//   taskName = '',
//   projectId: contextProjectId = '',
//   projectName: contextProjectName = '',
//   onBack,
// }: DailyTodoScreenProps) {
//   const [items, setItems] = useState<LocalDailyTodoItem[]>([])
//   const [todosLoadNote, setTodosLoadNote] = useState<string | null>(null)
//   const [projectOptions, setProjectOptions] = useState<DailyTodoProjectOption[]>([])
//   const [projectLoadNote, setProjectLoadNote] = useState<string | null>(null)
//   const [taskOptions, setTaskOptions] = useState<DailyTodoTaskOption[]>([])
//   const [taskLoadNote, setTaskLoadNote] = useState<string | null>(null)

//   const visibleProjectOptions = suppliedProjects ?? projectOptions
//   const visibleProjectLoadNote = suppliedProjects !== undefined ? null : projectLoadNote

//   const [viewFilter, setViewFilter] = useState<TodoViewFilter>('all')
//   const [selectedDate, setSelectedDate] = useState(() =>
//     taskId ? '' : localDateKey(new Date()),
//   )
//   const [selectedTaskFilter, setSelectedTaskFilter] = useState(taskId || 'all')
//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [formResetKey, setFormResetKey] = useState(0)

//   // Load Project choices from ERPNext.
//   useEffect(() => {
//     if (suppliedProjects !== undefined) return

//     let cancelled = false

//     void mementoApi.getDocTypeRecords({
//       doctype: 'My Projects',
//       start: 0,
//       page_length: 100,
//     }).then((response) => {
//       if (cancelled) return

//       const options = response.data
//         .map((record: MementoRecord) => ({
//           id: record.name,
//           label: getText(record.project_name) || record.name,
//         }))
//         .filter((option) => Boolean(option.id))

//       setProjectOptions(options)
//       setProjectLoadNote(
//         options.length === 0
//           ? 'No projects were returned.'
//           : null,
//       )
//     }).catch(() => {
//       if (cancelled) return
//       setProjectOptions([])
//       setProjectLoadNote('Projects could not be loaded.')
//     })

//     return () => {
//       cancelled = true
//     }
//   }, [suppliedProjects])

//   // Load Task choices for the right-side Task filter.
//   useEffect(() => {
//     let cancelled = false

//     void mementoApi.getDocTypeRecords({
//       doctype: 'Tasks',
//       start: 0,
//       page_length: 100,
//     }).then((response) => {
//       if (cancelled) return

//       const options: DailyTodoTaskOption[] = response.data
//         .map((record: MementoRecord) => ({
//           id: record.name,
//           label: getText(record.task_name) || record.name,
//           projectId: typeof record.project === 'string' ? record.project : '',
//           projectLabel: '',
//         }))
//         .filter((option) => Boolean(option.id))

//       setTaskOptions(options)
//       setTaskLoadNote(null)
//     }).catch(() => {
//       if (cancelled) return
//       setTaskOptions([])
//       setTaskLoadNote('Task choices could not be loaded.')
//     })

//     return () => {
//       cancelled = true
//     }
//   }, [])

//   // Load Task To-Do child rows from ERPNext.
//   const loadTodos = useCallback(async () => {
//     try {
//       const response = await mementoApi.getDocTypeRecords({
//         doctype: 'ToDo Table',
//         start: 0,
//         page_length: 100,
//       })

//       const mapped: LocalDailyTodoItem[] = response.data.map((record: MementoRecord) => {
//         const recordProjectId = typeof record.project === 'string' ? record.project : ''
//         const recordProjectLabel =
//           visibleProjectOptions.find((project) => project.id === recordProjectId)?.label ||
//           recordProjectId

//         const startedAt =
//           typeof record.start_on === 'string' && record.start_on
//             ? record.start_on.replace(' ', 'T')
//             : typeof record.creation === 'string' && record.creation
//               ? record.creation.replace(' ', 'T')
//               : new Date().toISOString()

//         const completedAt =
//           typeof record.end_on === 'string' && record.end_on
//             ? record.end_on.replace(' ', 'T')
//             : null

//         return {
//           id: record.name,
//           title: getText(record.todo) || String(record.todo ?? ''),
//           projectId: recordProjectId,
//           projectLabel: recordProjectLabel,
//           taskId: typeof record.task_id === 'string' ? record.task_id : '',
//           taskLabel: getText(record.task_name) || String(record.task_id ?? ''),
//           priority: 'Medium',
//           completed: Number(record.status) === 1,
//           createdAt: startedAt,
//           startedAt,
//           completedAt,
//           updatedAt: completedAt || startedAt,
//         }
//       })

//       setItems(mapped)
//       setTodosLoadNote(null)
//     } catch {
//       setTodosLoadNote('To-Do items could not be loaded from ERPNext.')
//     }
//   }, [visibleProjectOptions])

//   useEffect(() => {
//     void loadTodos()
//   }, [loadTodos])

//   const visibleTaskOptions = useMemo(() => {
//     const options = new Map<string, DailyTodoTaskOption>()

//     for (const task of taskOptions) {
//       options.set(task.id, task)
//     }

//     for (const item of items) {
//       if (!item.taskId) continue
//       if (!options.has(item.taskId)) {
//         options.set(item.taskId, {
//           id: item.taskId,
//           label: item.taskLabel || item.taskId,
//           projectId: item.projectId,
//           projectLabel: item.projectLabel,
//         })
//       }
//     }

//     if (taskId && !options.has(taskId)) {
//       options.set(taskId, {
//         id: taskId,
//         label: taskName || taskId,
//         projectId: contextProjectId,
//         projectLabel: contextProjectName,
//       })
//     }

//     return [...options.values()].sort((a, b) => a.label.localeCompare(b.label))
//   }, [taskOptions, items, taskId, taskName, contextProjectId, contextProjectName])

//   const taskFilterOptions = useMemo(
//     () => [
//       {
//         value: 'all',
//         label: 'All tasks',
//       },
//       ...visibleTaskOptions.map((task) => ({
//         value: task.id,
//         label: task.label,
//         description: task.projectLabel || undefined,
//       })),
//     ],
//     [visibleTaskOptions],
//   )

//   const selectedTask = visibleTaskOptions.find(
//     (task) => task.id === selectedTaskFilter,
//   )

//   const activeTaskId = selectedTaskFilter === 'all' ? '' : selectedTaskFilter
//   const activeTaskName = selectedTask?.label || (
//     activeTaskId === taskId ? taskName : ''
//   )
//   const activeProjectId = selectedTask?.projectId || (
//     activeTaskId === taskId ? contextProjectId : ''
//   )
//   const activeProjectName =
//     selectedTask?.projectLabel ||
//     visibleProjectOptions.find((project) => project.id === activeProjectId)?.label ||
//     (activeTaskId === taskId ? contextProjectName : '')

//   const scopedItems = useMemo(() => {
//     return items.filter((item) => {
//       const matchesDate =
//         !selectedDate || localDateKey(new Date(item.startedAt)) === selectedDate
//       const matchesTask =
//         selectedTaskFilter === 'all' || item.taskId === selectedTaskFilter

//       return matchesDate && matchesTask
//     })
//   }, [items, selectedDate, selectedTaskFilter])

//   const visibleItems = useMemo(() => {
//     const matching = scopedItems.filter((item) => {
//       if (viewFilter === 'open') return !item.completed
//       if (viewFilter === 'completed') return item.completed
//       return true
//     })

//     return [...matching].sort((a, b) => {
//       if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
//       return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//     })
//   }, [scopedItems, viewFilter])

//   const completedCount = scopedItems.filter((item) => item.completed).length
//   const openCount = scopedItems.length - completedCount

//   function resetForm() {
//     setEditingId(null)
//     setFormResetKey((current) => current + 1)
//   }

//   async function toggleCompleted(id: string, completed: boolean) {
//     const now = new Date().toISOString()

//     // Optimistically update UI state
//     setItems((current) =>
//       current.map((item) =>
//         item.id === id
//           ? {
//               ...item,
//               completed,
//               completedAt: completed ? now : null,
//               updatedAt: now,
//             }
//           : item,
//       ),
//     )

//     try {
//       await mementoApi.updateDocTypeRecord('ToDo Table', id, {
//         status: completed ? 1 : 0,
//       })
//       await loadTodos()
//     } catch {
//       setTodosLoadNote('Could not update To-Do status in ERPNext.')
//       await loadTodos()
//     }
//   }

//   function beginEdit(item: LocalDailyTodoItem) {
//     setEditingId(item.id)
//     setFormResetKey((current) => current + 1)
//   }

//   function handleTaskFilterChange(value: string) {
//     setSelectedTaskFilter(value)
//     resetForm()
//   }

//   return (
//     <main className="task-todo-screen" aria-labelledby="task-todo-heading">
//       <header className="task-todo-header">
//         <div className="task-todo-header__copy">
//           {onBack && (
//             <button className="task-todo-back" type="button" onClick={onBack}>
//               <i className="ri-arrow-left-line" aria-hidden="true" />
//               {taskId ? 'Back to activity logs' : 'Back to tasks'}
//             </button>
//           )}
//           <h1 id="task-todo-heading">Task To-Do</h1>
//         </div>

//         <div className="task-todo-header__date">
//           <span>TODAY</span>
//           <strong>{formatDateHeading(new Date())}</strong>
//         </div>
//       </header>

//       <div className="task-todo-layout">
//         <section className="task-todo-main" aria-label="Task to-do workspace">
//           <section className="task-todo-list-card" aria-labelledby="task-todo-list-heading">
//             <div className="task-todo-section-heading">
//               <div>
//                 <p>
//                   {selectedDate ? formatSelectedDay(selectedDate) : 'Every date'}
//                   {' · '}
//                   {scopedItems.length} item{scopedItems.length === 1 ? '' : 's'}
//                 </p>
//               </div>
//             </div>

//             <div className="task-todo-items-scroll" aria-label="To-do items">
//               {visibleItems.length === 0 ? (
//                 <div className="task-todo-empty">
//                   <span className="task-todo-empty__icon" aria-hidden="true">
//                     <i className="ri-checkbox-circle-line" />
//                   </span>
//                   <h3>
//                     {viewFilter === 'completed'
//                       ? 'Nothing completed yet'
//                       : viewFilter === 'open'
//                         ? 'You are all caught up'
//                         : 'A clear space for your next step'}
//                   </h3>
//                   <p>Add a to-do using the form below. Your items will appear here.</p>
//                 </div>
//               ) : (
//                 <div className="task-todo-items">
//                   {visibleItems.map((item) => (
//                     <article
//                       key={item.id}
//                       className={`task-todo-item${item.completed ? ' is-completed' : ''}`}
//                     >
//                       <div className="task-todo-item__content">
//                         <h3>{item.title}</h3>

//                         <div className="task-todo-item__meta">
//                           {item.projectLabel && (
//                             <span className="task-todo-chip task-todo-chip--project">
//                               <i className="ri-folder-3-line" aria-hidden="true" />
//                               {item.projectLabel}
//                             </span>
//                           )}

//                           {item.taskLabel && (
//                             <span className="task-todo-chip task-todo-chip--task">
//                               <i className="ri-task-line" aria-hidden="true" />
//                               {item.taskLabel}
//                             </span>
//                           )}
//                         </div>

//                         <p className="task-todo-item__timestamps">
//                           <span>
//                             <i className="ri-play-circle-line" aria-hidden="true" />
//                             Started {formatDateTime(item.startedAt)}
//                           </span>

//                           {item.completedAt && (
//                             <span className="task-todo-item__completed-at">
//                               <i className="ri-check-double-line" aria-hidden="true" />
//                               Completed {formatDateTime(item.completedAt)}
//                             </span>
//                           )}
//                         </p>
//                       </div>

//                       <div className="task-todo-item__actions">
//                         {/* Completion checkbox updates status in ERPNext */}
//                         <label
//                           className="task-todo-item__check"
//                           aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
//                         >
//                           <input
//                             type="checkbox"
//                             checked={item.completed}
//                             onChange={(event) =>
//                               void toggleCompleted(item.id, event.target.checked)
//                             }
//                           />

//                           <span aria-hidden="true">
//                             <i className="ri-check-line" />
//                           </span>
//                         </label>

//                         {/* Modify button */}
//                         <button
//                           type="button"
//                           className="task-todo-item__edit"
//                           onClick={() => beginEdit(item)}
//                           aria-label={`Modify ${item.title}`}
//                         >
//                           <i className="ri-edit-line" aria-hidden="true" />
//                           <span>Modify</span>
//                         </button>
//                       </div>
//                     </article>
//                   ))}
//                 </div>
//               )}
//             </div>

//             <section
//               className={`task-todo-composer${editingId ? ' is-editing' : ''}`}
//               aria-labelledby="task-todo-composer-heading"
//             >
//               <div className="task-todo-composer__heading">
//                 <div>
//                   <h2 id="task-todo-composer-heading">
//                     {editingId ? 'Modify To-Do' : 'Add a To-Do'}
//                   </h2>
//                 </div>
//                 {editingId && (
//                   <button
//                     type="button"
//                     className="task-todo-composer__cancel-link"
//                     onClick={resetForm}
//                   >
//                     Cancel editing
//                   </button>
//                 )}
//               </div>

//               {!activeTaskId && !editingId ? (
//                 <p className="task-todo-composer__note" role="status">
//                   Choose a Task in the right panel before adding a To-Do.
//                 </p>
//               ) : (
//                 <MetadataDrivenForm
//                   key={`${editingId ?? 'create'}-${activeTaskId}-${formResetKey}`}
//                   doctype="ToDo Table"
//                   mode={editingId ? 'update' : 'create'}
//                   recordName={editingId ?? undefined}
//                   allowedFieldnames={['todo']}
//                   extraPayload={editingId ? undefined : { task_id: activeTaskId }}
//                   submitText={editingId ? 'Save To-Do' : 'Add To-Do'}
//                   showCancel={Boolean(editingId)}
//                   onCancel={resetForm}
//                   onSuccess={() => {
//                     resetForm()
//                     void loadTodos()
//                   }}
//                 />
//               )}

//               {(visibleProjectLoadNote || taskLoadNote || todosLoadNote) && (
//                 <p className="task-todo-composer__note" role="status">
//                   {todosLoadNote || taskLoadNote || visibleProjectLoadNote}
//                 </p>
//               )}
//             </section>
//           </section>
//         </section>

//         <aside className="task-todo-sidebar" aria-label="Task details and filters">
//           <section className="task-todo-context-card" aria-labelledby="task-todo-context-heading">
//             <span className="task-todo-eyebrow">CURRENT CONTEXT</span>
//             <h2 id="task-todo-context-heading">Task details</h2>

//             <div className="task-todo-context-item">
//               <span><i className="ri-folder-3-line" aria-hidden="true" /> PROJECT</span>
//               <strong>{activeProjectName || 'No project selected'}</strong>
//             </div>

//             <div className="task-todo-context-item">
//               <span><i className="ri-task-line" aria-hidden="true" /> TASK</span>
//               <strong>{activeTaskName || 'All tasks'}</strong>
//             </div>

//             <div className="task-todo-sidebar-divider" />

//             <div className="task-todo-filter-section" aria-labelledby="task-todo-filter-heading">
//               <span className="task-todo-eyebrow">REFINE YOUR LIST</span>
//               <h3 id="task-todo-filter-heading">Filters</h3>

//               <AppDatePicker
//                 className="task-todo-field"
//                 id="task-todo-filter-date"
//                 label="Day"
//                 value={selectedDate}
//                 onChange={setSelectedDate}
//                 placeholder="Select a date"
//                 clearable
//               />
//               <div className="task-todo-filter-actions">
//                 <button type="button" onClick={() => setSelectedDate('')} aria-pressed={!selectedDate}>
//                   All dates
//                 </button>
//                 <button type="button" onClick={() => setSelectedDate(localDateKey(new Date()))} aria-pressed={selectedDate === localDateKey(new Date())}>
//                   Today
//                 </button>
//               </div>

//               <div className="task-todo-sidebar-status" role="group" aria-label="Filter items by completion status">
//                 <span className="task-todo-filter-label">COMPLETION</span>
//                 {([
//                   ['all', `All (${scopedItems.length})`],
//                   ['open', `To do (${openCount})`],
//                   ['completed', `Completed (${completedCount})`],
//                 ] as const).map(([filter, label]) => (
//                   <button
//                     key={filter}
//                     type="button"
//                     className={`task-todo-status-filter${viewFilter === filter ? ' is-active' : ''}`}
//                     aria-pressed={viewFilter === filter}
//                     onClick={() => setViewFilter(filter)}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>

//               <AppCombobox
//                 className="task-todo-field task-todo-field--task-filter"
//                 id="task-todo-filter-task"
//                 label="Task"
//                 value={selectedTaskFilter}
//                 onChange={handleTaskFilterChange}
//                 options={taskFilterOptions}
//                 placeholder="Search tasks..."
//                 clearable={false}
//                 emptyText="No matching tasks found."
//               />

//               <div className="task-todo-sidebar-stats" aria-label="Filtered to-do counts">
//                 <div><span>IN VIEW</span><strong>{scopedItems.length}</strong></div>
//                 <div><span>TO DO</span><strong>{openCount}</strong></div>
//                 <div><span>DONE</span><strong>{completedCount}</strong></div>
//               </div>
//             </div>

//             <p className="task-todo-local-note">
//               <i className="ri-cloud-line" aria-hidden="true" />
//               To-Do items are synced with ERPNext.
//             </p>
//           </section>
//         </aside>
//       </div>
//     </main>
//   )
// }














import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  mementoApi,
  type MementoRecord,
} from '../../services/mementoApi'
import type {
  DailyTodoProjectOption,
  LocalDailyTodoItem,
} from './dailyTodoTypes'

import './DailyTodoScreen.css'

import {
  AppDatePicker,
  AppCombobox,
} from '../../components/controls'
import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'

type TodoViewFilter = 'all' | 'open' | 'completed'

interface DailyTodoScreenProps {
  projects?: DailyTodoProjectOption[]
  taskId?: string
  taskName?: string
  projectId?: string
  projectName?: string
  onBack?: () => void
}

interface DailyTodoTaskOption {
  id: string
  label: string
  projectId: string
  projectLabel: string
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDateHeading(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatSelectedDay(value: string): string {
  if (!value) return 'All dates'
  const [year, month, day] = value.split('-').map(Number)
  return formatDateHeading(new Date(year, month - 1, day))
}

function getText(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (typeof DOMParser === 'undefined') return value.trim()

  const parsed = new DOMParser().parseFromString(value, 'text/html')
  return (parsed.body.textContent ?? value).replace(/\s+/g, ' ').trim()
}

export function DailyTodoScreen({
  projects: suppliedProjects,
  taskId = '',
  taskName = '',
  projectId: contextProjectId = '',
  projectName: contextProjectName = '',
  onBack,
}: DailyTodoScreenProps) {
  const [items, setItems] = useState<LocalDailyTodoItem[]>([])
  const [todosLoadNote, setTodosLoadNote] = useState<string | null>(null)
  const [projectOptions, setProjectOptions] = useState<DailyTodoProjectOption[]>([])
  const [projectLoadNote, setProjectLoadNote] = useState<string | null>(null)
  const [taskOptions, setTaskOptions] = useState<DailyTodoTaskOption[]>([])
  const [taskLoadNote, setTaskLoadNote] = useState<string | null>(null)

  const visibleProjectOptions = suppliedProjects ?? projectOptions
  const visibleProjectLoadNote = suppliedProjects !== undefined ? null : projectLoadNote

  const [viewFilter, setViewFilter] = useState<TodoViewFilter>('all')
  const [selectedDate, setSelectedDate] = useState(() =>
    taskId ? '' : localDateKey(new Date()),
  )
  const [selectedTaskFilter, setSelectedTaskFilter] = useState(taskId || 'all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formResetKey, setFormResetKey] = useState(0)

  // Close the Modify dialog on Escape key press.
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

  // Load Project choices from ERPNext.
  useEffect(() => {
    if (suppliedProjects !== undefined) return

    let cancelled = false

    void mementoApi.getDocTypeRecords({
      doctype: 'My Projects',
      start: 0,
      page_length: 100,
    }).then((response) => {
      if (cancelled) return

      const options = response.data
        .map((record: MementoRecord) => ({
          id: record.name,
          label: getText(record.project_name) || record.name,
        }))
        .filter((option) => Boolean(option.id))

      setProjectOptions(options)
      setProjectLoadNote(
        options.length === 0
          ? 'No projects were returned.'
          : null,
      )
    }).catch(() => {
      if (cancelled) return
      setProjectOptions([])
      setProjectLoadNote('Projects could not be loaded.')
    })

    return () => {
      cancelled = true
    }
  }, [suppliedProjects])

  // Load Task choices for the right-side Task filter.
  useEffect(() => {
    let cancelled = false

    void mementoApi.getDocTypeRecords({
      doctype: 'Tasks',
      start: 0,
      page_length: 100,
    }).then((response) => {
      if (cancelled) return

      const options: DailyTodoTaskOption[] = response.data
        .map((record: MementoRecord) => ({
          id: record.name,
          label: getText(record.task_name) || record.name,
          projectId: typeof record.project === 'string' ? record.project : '',
          projectLabel: '',
        }))
        .filter((option) => Boolean(option.id))

      setTaskOptions(options)
      setTaskLoadNote(null)
    }).catch(() => {
      if (cancelled) return
      setTaskOptions([])
      setTaskLoadNote('Task choices could not be loaded.')
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Load Task To-Do child rows from ERPNext.
  const loadTodos = useCallback(async () => {
    try {
      const response = await mementoApi.getDocTypeRecords({
        doctype: 'ToDo Table',
        start: 0,
        page_length: 100,
      })

      const mapped: LocalDailyTodoItem[] = response.data.map((record: MementoRecord) => {
        const recordProjectId = typeof record.project === 'string' ? record.project : ''
        const recordProjectLabel =
          visibleProjectOptions.find((project) => project.id === recordProjectId)?.label ||
          recordProjectId

        const startedAt =
          typeof record.start_on === 'string' && record.start_on
            ? record.start_on.replace(' ', 'T')
            : typeof record.creation === 'string' && record.creation
              ? record.creation.replace(' ', 'T')
              : new Date().toISOString()

        const completedAt =
          typeof record.end_on === 'string' && record.end_on
            ? record.end_on.replace(' ', 'T')
            : null

        return {
          id: record.name,
          title: getText(record.todo) || String(record.todo ?? ''),
          projectId: recordProjectId,
          projectLabel: recordProjectLabel,
          taskId: typeof record.task_id === 'string' ? record.task_id : '',
          taskLabel: getText(record.task_name) || String(record.task_id ?? ''),
          priority: 'Medium',
          completed: Number(record.status) === 1,
          createdAt: startedAt,
          startedAt,
          completedAt,
          updatedAt: completedAt || startedAt,
        }
      })

      setItems(mapped)
      setTodosLoadNote(null)
    } catch {
      setTodosLoadNote('To-Do items could not be loaded from ERPNext.')
    }
  }, [visibleProjectOptions])

  useEffect(() => {
    void loadTodos()
  }, [loadTodos])

  const visibleTaskOptions = useMemo(() => {
    const options = new Map<string, DailyTodoTaskOption>()

    for (const task of taskOptions) {
      options.set(task.id, task)
    }

    for (const item of items) {
      if (!item.taskId) continue
      if (!options.has(item.taskId)) {
        options.set(item.taskId, {
          id: item.taskId,
          label: item.taskLabel || item.taskId,
          projectId: item.projectId,
          projectLabel: item.projectLabel,
        })
      }
    }

    if (taskId && !options.has(taskId)) {
      options.set(taskId, {
        id: taskId,
        label: taskName || taskId,
        projectId: contextProjectId,
        projectLabel: contextProjectName,
      })
    }

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [taskOptions, items, taskId, taskName, contextProjectId, contextProjectName])

  const taskFilterOptions = useMemo(
    () => [
      {
        value: 'all',
        label: 'All tasks',
      },
      ...visibleTaskOptions.map((task) => ({
        value: task.id,
        label: task.label,
        description: task.projectLabel || undefined,
      })),
    ],
    [visibleTaskOptions],
  )

  const selectedTask = visibleTaskOptions.find(
    (task) => task.id === selectedTaskFilter,
  )

  const activeTaskId = selectedTaskFilter === 'all' ? '' : selectedTaskFilter
  const activeTaskName = selectedTask?.label || (
    activeTaskId === taskId ? taskName : ''
  )
  const activeProjectId = selectedTask?.projectId || (
    activeTaskId === taskId ? contextProjectId : ''
  )
  const activeProjectName =
    selectedTask?.projectLabel ||
    visibleProjectOptions.find((project) => project.id === activeProjectId)?.label ||
    (activeTaskId === taskId ? contextProjectName : '')

  const scopedItems = useMemo(() => {
    return items.filter((item) => {
      const matchesDate =
        !selectedDate || localDateKey(new Date(item.startedAt)) === selectedDate
      const matchesTask =
        selectedTaskFilter === 'all' || item.taskId === selectedTaskFilter

      return matchesDate && matchesTask
    })
  }, [items, selectedDate, selectedTaskFilter])

  const visibleItems = useMemo(() => {
    const matching = scopedItems.filter((item) => {
      if (viewFilter === 'open') return !item.completed
      if (viewFilter === 'completed') return item.completed
      return true
    })

    return [...matching].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [scopedItems, viewFilter])

  const completedCount = scopedItems.filter((item) => item.completed).length
  const openCount = scopedItems.length - completedCount

  function resetCreateComposer() {
    setFormResetKey((current) => current + 1)
  }

  function closeEditModal() {
    setEditingId(null)
  }

  async function toggleCompleted(id: string, completed: boolean) {
    const now = new Date().toISOString()

    // Optimistically update UI state
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              completed,
              completedAt: completed ? now : null,
              updatedAt: now,
            }
          : item,
      ),
    )

    try {
      await mementoApi.updateDocTypeRecord('ToDo Table', id, {
        status: completed ? 1 : 0,
      })
      await loadTodos()
    } catch {
      setTodosLoadNote('Could not update To-Do status in ERPNext.')
      await loadTodos()
    }
  }

  function beginEdit(item: LocalDailyTodoItem) {
    setEditingId(item.id)
  }

  function handleTaskFilterChange(value: string) {
    setSelectedTaskFilter(value)
    setEditingId(null)
    resetCreateComposer()
  }

  return (
    <main className="task-todo-screen" aria-labelledby="task-todo-heading">
      <header className="task-todo-header">
        <div className="task-todo-header__copy">
          {onBack && (
            <button className="task-todo-back" type="button" onClick={onBack}>
              <i className="ri-arrow-left-line" aria-hidden="true" />
              {taskId ? 'Back to activity logs' : 'Back to tasks'}
            </button>
          )}
          <h1 id="task-todo-heading">Task To-Do</h1>
        </div>

        <div className="task-todo-header__date">
          <span>TODAY</span>
          <strong>{formatDateHeading(new Date())}</strong>
        </div>
      </header>

      <div className="task-todo-layout">
        <section className="task-todo-main" aria-label="Task to-do workspace">
          <section className="task-todo-list-card" aria-labelledby="task-todo-list-heading">
            <div className="task-todo-section-heading">
              <div>
                <p>
                  {selectedDate ? formatSelectedDay(selectedDate) : 'Every date'}
                  {' · '}
                  {scopedItems.length} item{scopedItems.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="task-todo-items-scroll" aria-label="To-do items">
              {visibleItems.length === 0 ? (
                <div className="task-todo-empty">
                  <span className="task-todo-empty__icon" aria-hidden="true">
                    <i className="ri-checkbox-circle-line" />
                  </span>
                  <h3>
                    {viewFilter === 'completed'
                      ? 'Nothing completed yet'
                      : viewFilter === 'open'
                        ? 'You are all caught up'
                        : 'A clear space for your next step'}
                  </h3>
                  <p>Add a to-do using the form below. Your items will appear here.</p>
                </div>
              ) : (
                <div className="task-todo-items">
                  {visibleItems.map((item) => (
                    <article
                      key={item.id}
                      className={`task-todo-item${item.completed ? ' is-completed' : ''}`}
                    >
                      <div className="task-todo-item__content">
                        <h3>{item.title}</h3>

                        <div className="task-todo-item__meta">
                          {item.projectLabel && (
                            <span className="task-todo-chip task-todo-chip--project">
                              <i className="ri-folder-3-line" aria-hidden="true" />
                              {item.projectLabel}
                            </span>
                          )}

                          {item.taskLabel && (
                            <span className="task-todo-chip task-todo-chip--task">
                              <i className="ri-task-line" aria-hidden="true" />
                              {item.taskLabel}
                            </span>
                          )}
                        </div>

                        <p className="task-todo-item__timestamps">
                          <span>
                            <i className="ri-play-circle-line" aria-hidden="true" />
                            Started {formatDateTime(item.startedAt)}
                          </span>

                          {item.completedAt && (
                            <span className="task-todo-item__completed-at">
                              <i className="ri-check-double-line" aria-hidden="true" />
                              Completed {formatDateTime(item.completedAt)}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="task-todo-item__actions">
                        {/* Completion checkbox updates status in ERPNext */}
                        <label
                          className="task-todo-item__check"
                          aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
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

                        {/* Modify button opens the Edit Dialog */}
                        <button
                          type="button"
                          className="task-todo-item__edit"
                          onClick={() => beginEdit(item)}
                          aria-label={`Modify ${item.title}`}
                        >
                          <i className="ri-edit-line" aria-hidden="true" />
                          <span>Modify</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <section
              className="task-todo-composer"
              aria-labelledby="task-todo-composer-heading"
            >
              <div className="task-todo-composer__heading">
                <div>
                  <h2 id="task-todo-composer-heading">Add a To-Do</h2>
                </div>
              </div>

              {!activeTaskId ? (
                <p className="task-todo-composer__note" role="status">
                  Choose a Task in the right panel before adding a To-Do.
                </p>
              ) : (
                <MetadataDrivenForm
                  key={`create-${activeTaskId}-${formResetKey}`}
                  doctype="ToDo Table"
                  mode="create"
                  allowedFieldnames={['todo']}
                  extraPayload={{ task_id: activeTaskId }}
                  submitText="Add To-Do"
                  showCancel={false}
                  onCancel={resetCreateComposer}
                  onSuccess={() => {
                    resetCreateComposer()
                    void loadTodos()
                  }}
                />
              )}

              {(visibleProjectLoadNote || taskLoadNote || todosLoadNote) && (
                <p className="task-todo-composer__note" role="status">
                  {todosLoadNote || taskLoadNote || visibleProjectLoadNote}
                </p>
              )}
            </section>
          </section>
        </section>

        <aside className="task-todo-sidebar" aria-label="Task details and filters">
          <section className="task-todo-context-card" aria-labelledby="task-todo-context-heading">
            <span className="task-todo-eyebrow">CURRENT CONTEXT</span>
            <h2 id="task-todo-context-heading">Task details</h2>

            <div className="task-todo-context-item">
              <span><i className="ri-folder-3-line" aria-hidden="true" /> PROJECT</span>
              <strong>{activeProjectName || 'No project selected'}</strong>
            </div>

            <div className="task-todo-context-item">
              <span><i className="ri-task-line" aria-hidden="true" /> TASK</span>
              <strong>{activeTaskName || 'All tasks'}</strong>
            </div>

            <div className="task-todo-sidebar-divider" />

            <div className="task-todo-filter-section" aria-labelledby="task-todo-filter-heading">
              <span className="task-todo-eyebrow">REFINE YOUR LIST</span>
              <h3 id="task-todo-filter-heading">Filters</h3>

              <AppDatePicker
                className="task-todo-field"
                id="task-todo-filter-date"
                label="Day"
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Select a date"
                clearable
              />
              <div className="task-todo-filter-actions">
                <button type="button" onClick={() => setSelectedDate('')} aria-pressed={!selectedDate}>
                  All dates
                </button>
                <button type="button" onClick={() => setSelectedDate(localDateKey(new Date()))} aria-pressed={selectedDate === localDateKey(new Date())}>
                  Today
                </button>
              </div>

              <div className="task-todo-sidebar-status" role="group" aria-label="Filter items by completion status">
                <span className="task-todo-filter-label">COMPLETION</span>
                {([
                  ['all', `All (${scopedItems.length})`],
                  ['open', `To do (${openCount})`],
                  ['completed', `Completed (${completedCount})`],
                ] as const).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    className={`task-todo-status-filter${viewFilter === filter ? ' is-active' : ''}`}
                    aria-pressed={viewFilter === filter}
                    onClick={() => setViewFilter(filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AppCombobox
                className="task-todo-field task-todo-field--task-filter"
                id="task-todo-filter-task"
                label="Task"
                value={selectedTaskFilter}
                onChange={handleTaskFilterChange}
                options={taskFilterOptions}
                placeholder="Search tasks..."
                clearable={false}
                emptyText="No matching tasks found."
              />

              <div className="task-todo-sidebar-stats" aria-label="Filtered to-do counts">
                <div><span>IN VIEW</span><strong>{scopedItems.length}</strong></div>
                <div><span>TO DO</span><strong>{openCount}</strong></div>
                <div><span>DONE</span><strong>{completedCount}</strong></div>
              </div>
            </div>

            <p className="task-todo-local-note">
              <i className="ri-cloud-line" aria-hidden="true" />
              To-Do items are synced with ERPNext.
            </p>
          </section>
        </aside>
      </div>

      {/* Modify To-Do Dialog */}
      {editingId && (
        <div
          className="todo-edit-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal()
            }
          }}
        >
          <div
            className="todo-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="todo-edit-modal-title"
          >
            <div className="todo-edit-modal__header">
              <div>
                <span className="task-todo-eyebrow">UPDATE STEP</span>
                <h2 id="todo-edit-modal-title">Modify To-Do</h2>
              </div>
              <button
                type="button"
                className="todo-edit-modal__close"
                onClick={closeEditModal}
                aria-label="Close dialog"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <MetadataDrivenForm
              key={`update-${editingId}`}
              doctype="ToDo Table"
              mode="update"
              recordName={editingId}
              allowedFieldnames={['todo']}
              submitText="Save To-Do"
              showCancel
              onCancel={closeEditModal}
              onSuccess={() => {
                closeEditModal()
                void loadTodos()
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}