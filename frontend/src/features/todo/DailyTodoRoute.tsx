import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { DailyTodoScreen } from './DailyTodoScreen'

/** Reads Task/Project context passed from the Activity Logs screen. */
export function DailyTodoRoute() {
  const navigate = useNavigate()
  const location = useLocation()

  const context = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      taskId: params.get('task_id') ?? '',
      taskName: params.get('task_label') ?? params.get('task_name') ?? '',
      projectId: params.get('project_id') ?? '',
      projectName: params.get('project_label') ?? params.get('project_name') ?? '',
    }
  }, [location.search])

  const backUrl = useMemo(() => {
    if (!context.taskId) return '/tasks'

    const params = new URLSearchParams()
    params.set('task_id', context.taskId)
    if (context.taskName) params.set('task_label', context.taskName)
    if (context.projectId) params.set('project_id', context.projectId)
    if (context.projectName) params.set('project_label', context.projectName)
    return `/activity?${params.toString()}`
  }, [context])

  return (
    <DailyTodoScreen
      key={`${context.taskId}:${context.projectId}`}
      taskId={context.taskId}
      taskName={context.taskName}
      projectId={context.projectId}
      projectName={context.projectName}
      onBack={() => navigate(backUrl)}
    />
  )
}