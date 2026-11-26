import {
  useCallback,
  useRef,
  useState,
} from 'react'

import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import './App.css'

import { RecordCreatePage } from './features/records/RecordCreatePage'

import {
  FloatingNavigation,
  type NavigationItemId,
} from './components/navigation/FloatingNavigation'

import { useTheme } from './hooks/useTheme'

import {
  FeatureShowcase,
  type FeatureNavigationRequest,
} from './features/home/FeatureShowcase'

import {
  featureCards,
  type FeatureDefinition,
} from './features/home/featureData'

import { RecordDetailPage } from './features/records/RecordDetailsPage'

import { RecordPage } from './features/records/RecordPage'

import { DailyTodoRoute } from './features/todo/DailyTodoRoute'

import { TaskActivityLogScreen } from './features/activity/TaskActivityLogScreen'

import { PersonalDailyTodoScreen } from './features/todo/PersonalDailyTodoScreen'

function RecordsRoute({
  onBack,
}: {
  onBack: () => void
}) {
  const { featureId } = useParams<{ featureId: string }>()

  const feature = featureCards.find(
    (item) => item.id === featureId,
  )

  if (!feature) {
    return <Navigate to="/" replace />
  }

  return (
    <RecordPage
      key={feature.id}
      feature={feature}
      onBack={onBack}
    />
  )
}

function RecordDetailRoute() {
  const { featureId, recordName } = useParams<{
    featureId: string
    recordName: string
  }>()

  const navigate = useNavigate()

  const feature = featureCards.find(
    (item) => item.id === featureId,
  )

  if (
    !feature ||
    (feature.id !== 'projects' && feature.id !== 'tasks') ||
    !recordName
  ) {
    return <Navigate to="/" replace />
  }

  return (
    <RecordDetailPage
      key={`${feature.id}:${recordName}`}
      feature={feature}
      recordName={recordName}
      onClose={() => navigate(`/${feature.id}`, { replace: true })}
    />
  )
}

function RecordCreateRoute() {
  const { featureId } = useParams<{ featureId: string }>()
  const navigate = useNavigate()

  const feature = featureCards.find(
    (item) => item.id === featureId,
  )

  if (!feature) {
    return <Navigate to="/" replace />
  }

  return (
    <RecordCreatePage
      key={`${feature.id}-create`}
      feature={feature}
      onCancel={() => {
        navigate(`/${feature.id}`)
      }}
      onCreated={() => {
        navigate(`/${feature.id}`, {
          replace: true,
        })
      }}
    />
  )
}



function TaskActivityLogRoute() {
  const { taskId } = useParams<{ taskId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)

  const resolvedTaskId =
    taskId ||
    searchParams.get('task_id') ||
    searchParams.get('taskId') ||
    ''
  const resolvedTaskName = searchParams.get('task_label') || ''
  const resolvedProjectId = searchParams.get('project_id') || ''
  const resolvedProjectName = searchParams.get('project_label') || ''

  return (
    <TaskActivityLogScreen
      taskId={resolvedTaskId}
      taskName={resolvedTaskName}
      projectId={resolvedProjectId}
      projectName={resolvedProjectName}
      onBack={() => navigate('/tasks')}
      onOpenTaskTodos={({ taskId: id, taskName: tName, projectId: pId, projectName: pName }) => {
        const params = new URLSearchParams({ task_id: id })
        if (tName) params.set('task_label', tName)
        if (pId) params.set('project_id', pId)
        if (pName) params.set('project_label', pName)
        navigate(`/daily-todo?${params.toString()}`)
      }}
    />
  )
}

function MementoApp() {
  const navigate = useNavigate()
  const location = useLocation()

  const [dashboardActiveItem, setDashboardActiveItem] =
    useState<NavigationItemId>('dashboard')

  const [navigationRequest, setNavigationRequest] =
    useState<FeatureNavigationRequest | null>(null)

  const navigationSequence = useRef(0)

  const { theme, toggleTheme } = useTheme()

  const currentFeature: FeatureDefinition | undefined =
    featureCards.find(
      (feature) =>
        location.pathname === `/${feature.id}` ||
        location.pathname.startsWith(`/${feature.id}/`),
    )

  const resolvedFeature =
    currentFeature ??
    featureCards.find((feature) =>
      location.pathname.startsWith('/daily-todo')
        ? feature.id === 'tasks'
        : location.pathname.startsWith('/activity') ||
            location.pathname.endsWith('/activity-logs')
          ? feature.id === 'activity'
          : false,
    )

  const activeItem: NavigationItemId =
    location.pathname === '/'
      ? dashboardActiveItem
      : resolvedFeature?.navItem ?? 'dashboard'

  const requestDashboardScroll = useCallback(() => {
    navigationSequence.current += 1

    setNavigationRequest({
      item: 'dashboard',
      sequence: navigationSequence.current,
    })
  }, [])

  const handleNavigate = useCallback(
    (item: NavigationItemId) => {
      if (item === 'dashboard') {
        setDashboardActiveItem('dashboard')
        requestDashboardScroll()
        navigate('/')
        return
      }

      const feature = featureCards.find(
        (candidate) => candidate.navItem === item,
      )

      if (feature) {
        navigate(`/${feature.id}`)
      }
    },
    [navigate, requestDashboardScroll],
  )

  const handleActiveFeatureChange = useCallback(
    (item: NavigationItemId) => {
      setDashboardActiveItem(item)
    },
    [],
  )

  const handleOpenRecords = useCallback(
    (feature: FeatureDefinition) => {
      navigate(`/${feature.id}`)
    },
    [navigate],
  )

  const handleBackToOverview = useCallback(() => {
    setDashboardActiveItem('dashboard')
    requestDashboardScroll()
    navigate('/')
  }, [navigate, requestDashboardScroll])

  return (
    <div className="app">
      <FloatingNavigation
        activeItem={activeItem}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <FeatureShowcase
                onActiveFeatureChange={handleActiveFeatureChange}
                navigationRequest={navigationRequest}
                onOpenRecords={handleOpenRecords}
              />
            }
          />

          <Route
            path="/todo"
            element={<PersonalDailyTodoScreen onBack={handleBackToOverview} />}
          />

          <Route
            path="/daily-todo"
            element={<DailyTodoRoute />}
          />

          <Route
            path="/activity"
            element={<TaskActivityLogRoute />}
          />

          <Route
            path="/activity-logs"
            element={<TaskActivityLogRoute />}
          />

          <Route
            path="/tasks/:taskId/activity-logs"
            element={<TaskActivityLogRoute />}
          />

          <Route
            path="/:featureId/new"
            element={<RecordCreateRoute />}
          />

          <Route
            path="/:featureId/:recordName"
            element={<RecordDetailRoute />}
          />

          <Route
            path="/:featureId"
            element={
              <RecordsRoute
                onBack={handleBackToOverview}
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <MementoApp />
    </HashRouter>
  )
}

export default App