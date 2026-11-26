import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
  type PaginationInfo,
} from '../../services/mementoApi'
import type { FeatureDefinition } from '../home/featureData'
import { RecordTable } from '../../components/list/RecordTable'
import { RecordCard } from '../../components/list/RecordCard'
import { RecordUpdateDialog } from '../../components/form/RecordUpdateDialog'
import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'

import {
  AppDatePicker,
  AppSelect,
  AppCombobox,
} from '../../components/controls'

import './RecordPage.css'

gsap.registerPlugin(ScrollTrigger)

const PAGE_LENGTH = 20

const CREATE_LABEL_BY_FEATURE: Record<FeatureDefinition['id'], string> = {
  projects: 'Project',
  tasks: 'Task',
  todo: 'To-do item',
  activity: 'Activity Log',
}

const FILTER_FIELDS_BY_FEATURE: Record<
  FeatureDefinition['id'],
  string[]
> = {
  projects: ['status', 'category', 'priority_level'],
  tasks: ['status', 'priority', 'project'],
  todo: ['status', 'priority', 'date'],
  activity: ['task_id', 'today'],
}

const LINK_FILTER_DOCTYPES: Partial<
  Record<FeatureDefinition['id'], Record<string, string>>
> = {
  tasks: {
    project: 'My Projects',
  },
  activity: {
    task_id: 'Tasks',
  },
}

interface FilterOption {
  value: string
  label: string
}

function getSelectOptions(options: unknown): string[] {
  if (typeof options !== 'string') return []

  return options
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)
}

interface RecordPageProps {
  feature: FeatureDefinition
  onBack: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong while loading records.'
}

export function RecordPage({ feature, onBack }: RecordPageProps) {
  const doctype = feature.doctype
  const navigate = useNavigate()
  const location = useLocation()

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )

  const activeFilters = useMemo<Record<string, unknown>>(() => {
    const result: Record<string, unknown> = {}

    for (const fieldname of FILTER_FIELDS_BY_FEATURE[feature.id]) {
      const value = queryParams.get(fieldname)

      if (value) {
        result[fieldname] = value
      }
    }

    return result
  }, [feature.id, queryParams])

  const activeFilterCount = Object.keys(activeFilters).length

  const [linkFilterOptions, setLinkFilterOptions] =
    useState<Record<string, FilterOption[]>>({})

  const pageRef = useRef<HTMLElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)

  const isCardFeature = feature.id === 'projects' || feature.id === 'tasks'

  const [metadata, setMetadata] = useState<DocTypeMetadata | null>(null)
  const [records, setRecords] = useState<MementoRecord[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [editingRecordName, setEditingRecordName] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [start, setStart] = useState(0)

  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0)
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0)

  const recordsRequestKey = useMemo(
    () => JSON.stringify({
      doctype,
      start,
      activeSearch,
      activeFilters,
      recordsRefreshKey,
    }),
    [doctype, start, activeSearch, activeFilters, recordsRefreshKey],
  )
  const [completedRecordsRequestKey, setCompletedRecordsRequestKey] =
    useState<string | null>(null)
  const [recordsErrorState, setRecordsErrorState] = useState<{
    requestKey: string
    message: string
  } | null>(null)

  const recordsLoading = completedRecordsRequestKey !== recordsRequestKey
  const recordsError =
    recordsErrorState?.requestKey === recordsRequestKey
      ? recordsErrorState.message
      : null

  // Animate top header and compact control bar on feature entry
  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) return

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
      })

      timeline
        .fromTo(
          '.record-page__back',
          { autoAlpha: 0, x: -10 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.34,
            clearProps: 'opacity,visibility,transform',
          },
          0,
        )
        .fromTo(
          '.record-page__heading-copy > *',
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.05,
            clearProps: 'opacity,visibility,transform',
          },
          0.05,
        )
        .fromTo(
          '.record-page__heading-actions > *',
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.36,
            stagger: 0.05,
            clearProps: 'opacity,visibility,transform',
          },
          0.12,
        )
        .fromTo(
          '.record-page__controls-bar',
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
            clearProps: 'opacity,visibility,transform',
          },
          0.16,
        )
    }, root)

    return () => context.revert()
  }, [feature.id])

  // Stagger-reveal cards or table container via ScrollTrigger when records load
  useEffect(() => {
    if (recordsLoading || !metadata) return

    const root = pageRef.current
    if (!root) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) return

    const context = gsap.context(() => {
      if (isCardFeature) {
        const cards = gsap.utils.toArray<HTMLElement>('.record-card')
        if (cards.length === 0) return

        gsap.fromTo(
          cards,
          {
            autoAlpha: 0,
            y: 18,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            stagger: 0.055,
            ease: 'power2.out',
            clearProps: 'opacity,visibility,transform',
            scrollTrigger: {
              trigger: '.record-card-grid',
              start: 'top 90%',
              once: true,
            },
          },
        )
      } else if (listContainerRef.current) {
        gsap.fromTo(
          listContainerRef.current,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            ease: 'power2.out',
            clearProps: 'opacity,visibility,transform',
          },
        )
      }
    }, root)

    return () => context.revert()
  }, [records, recordsLoading, metadata, isCardFeature, feature.id])

  // Load the visible list columns and field metadata.
  useEffect(() => {
    let cancelled = false
    void mementoApi
      .getDocTypeMetadata(doctype, 'list')
      .then((response) => {
        if (!cancelled) {
          setMetadata(response.data)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetadataError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetadataLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [doctype, metadataRefreshKey])

  // Load records whenever search, filters, page, feature, or refresh state changes.
  useEffect(() => {
    let cancelled = false
    const requestKey = recordsRequestKey

    void mementoApi
      .getDocTypeRecords({
        doctype,
        start,
        page_length: PAGE_LENGTH,
        ...(activeSearch ? { search: activeSearch } : {}),
        ...(Object.keys(activeFilters).length > 0
          ? { filters: activeFilters }
          : {}),
      })
      .then((response) => {
        if (cancelled) return

        setRecords(response.data)
        setPagination(response.pagination ?? null)
      })
      .catch((error: unknown) => {
        if (cancelled) return

        setRecords([])
        setPagination(null)
        setRecordsErrorState({ requestKey, message: getErrorMessage(error) })
      })
      .finally(() => {
        if (!cancelled) {
          setCompletedRecordsRequestKey(requestKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [doctype, start, activeSearch, activeFilters, recordsRefreshKey, recordsRequestKey])

  useEffect(() => {
    let cancelled = false

    async function loadLinkFilterOptions() {
      const linkedDoctypes =
        LINK_FILTER_DOCTYPES[feature.id] ?? {}

      const entries = await Promise.all(
        Object.entries(linkedDoctypes).map(
          async ([fieldname, linkedDoctype]) => {
            try {
              const response = await mementoApi.getDocTypeRecords({
                doctype: linkedDoctype,
                start: 0,
                page_length: 100,
              })

              const choices: FilterOption[] = response.data.map(
                (record) => ({
                  value: record.name,
                  label: String(
                    record.project_name ??
                      record.task_name ??
                      record.name,
                  ),
                }),
              )

              return [fieldname, choices] as const
            } catch {
              return [fieldname, [] as FilterOption[]] as const
            }
          },
        ),
      )

      if (cancelled) return

      const nextOptions: Record<string, FilterOption[]> = {}

      for (const [fieldname, choices] of entries) {
        nextOptions[fieldname] = choices
      }

      setLinkFilterOptions(nextOptions)
    }

    void loadLinkFilterOptions()

    return () => {
      cancelled = true
    }
  }, [feature.id])

  function updateFilter(fieldname: string, value: string) {
    const params = new URLSearchParams(location.search)

    if (value) {
      params.set(fieldname, value)
    } else {
      params.delete(fieldname)
    }

    const contextLabelKey =
      feature.id === 'tasks' && fieldname === 'project'
        ? 'project_label'
        : feature.id === 'activity' && fieldname === 'task_id'
          ? 'task_label'
          : null

    if (contextLabelKey) {
      const option = linkFilterOptions[fieldname]?.find(
        (item) => item.value === value,
      )

      if (option) {
        params.set(contextLabelKey, option.label)
      } else if (!value) {
        params.delete(contextLabelKey)
      }
    }

    setStart(0)

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    )
  }

  function clearFilters() {
    const params = new URLSearchParams(location.search)

    for (const fieldname of FILTER_FIELDS_BY_FEATURE[feature.id]) {
      params.delete(fieldname)
    }

    params.delete('project_label')
    params.delete('task_label')

    setStart(0)

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    )
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextSearch = searchInput.trim()

    if (nextSearch === activeSearch && start === 0) {
      setRecordsRefreshKey((value) => value + 1)
      return
    }

    setStart(0)
    setActiveSearch(nextSearch)
  }

  function clearSearch() {
    setSearchInput('')

    if (activeSearch === '' && start === 0) return

    setStart(0)
    setActiveSearch('')
  }

  const visibleFilterFields = useMemo(
    () =>
      FILTER_FIELDS_BY_FEATURE[feature.id]
        .map((fieldname) =>
          metadata?.fields.find(
            (field) => field.fieldname === fieldname,
          ),
        )
        .filter((field) => field && !field.hidden),
    [feature.id, metadata],
  )

  // Reuse the metadata-driven form for create flows across RecordPage features.
  if (isCreateOpen) {
    const singularLabel = CREATE_LABEL_BY_FEATURE[feature.id]

    return (
      <section
        className="record-create-page"
        aria-labelledby="record-create-page-title"
      >
        <button
          type="button"
          className="record-page__back"
          onClick={() => setIsCreateOpen(false)}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <header className="record-create-page__header">
          <span className="record-create-page__eyebrow">NEW RECORD</span>
          <h1 id="record-create-page-title">{singularLabel} information</h1>
          <p>Fields and validation are loaded from the backend.</p>
        </header>

        <div className="record-create-page__form-area">
          <MetadataDrivenForm
            key={`${feature.id}:create`}
            doctype={doctype}
            mode="create"
            onCancel={() => setIsCreateOpen(false)}
            onSuccess={(result) => {
              setIsCreateOpen(false)
              setActionMessage(`${singularLabel} ${result.name} created successfully.`)
              setStart(0)
              setSearchInput('')
              setActiveSearch('')
              setRecordsRefreshKey((value) => value + 1)

              navigate(
                { pathname: location.pathname, search: '' },
                { replace: true },
              )
            }}
          />
        </div>
      </section>
    )
  }

  return (
    <section
      ref={pageRef}
      className="record-page"
      aria-labelledby="record-page-title"
    >
      <div className="record-page__header">
        <button
          type="button"
          className="record-page__back"
          onClick={onBack}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to overview
        </button>

        <div className="record-page__heading-row">
          <div className="record-page__heading-copy">
            <span className="record-page__eyebrow">MEMENTO / WORKSPACE</span>

            <h1 id="record-page-title">
              {metadata?.label ?? feature.itemPlural}
            </h1>

            <p>{feature.description}</p>
          </div>

          <div className="record-page__heading-actions">
            {feature.id === 'activity' && Boolean(activeFilters.task_id) && (
              <button
                type="button"
                className="record-page__secondary-button record-page__todo-button"
                onClick={() => {
                  const params = new URLSearchParams()
                  const taskId = String(activeFilters.task_id)
                  const taskLabel = queryParams.get('task_label') || taskId
                  const projectId = queryParams.get('project_id') || ''
                  const projectLabel = queryParams.get('project_label') || ''

                  params.set('task_id', taskId)
                  params.set('task_label', taskLabel)
                  if (projectId) params.set('project_id', projectId)
                  if (projectLabel) params.set('project_label', projectLabel)

                  navigate(`/daily-todo?${params.toString()}`)
                }}
                aria-label="Open To-Do items for this task"
              >
                <i className="ri-list-check-2" aria-hidden="true" />
                Task To-Do
              </button>
            )}

            <button
              type="button"
              className="record-page__secondary-button"
              disabled={recordsLoading}
              onClick={() => {
                setRecordsRefreshKey((value) => value + 1)
              }}
              aria-label="Refresh records"
            >
              <i className="ri-refresh-line" aria-hidden="true" />
              Refresh
            </button>

            {metadata?.capabilities.can_create && (
              <button
                type="button"
                className="record-page__create-button"
                onClick={() => setIsCreateOpen(true)}
                aria-label={`Create a new ${CREATE_LABEL_BY_FEATURE[feature.id].toLowerCase()}`}
              >
                <i className="ri-add-line" aria-hidden="true" />
                Create New {CREATE_LABEL_BY_FEATURE[feature.id]}
              </button>
            )}
          </div>
        </div>

        {/* Compact unified Search + Filters bar */}
        <div className="record-page__controls-bar">
          <form
            className="record-page__search"
            onSubmit={handleSearch}
            role="search"
          >
            <i className="ri-search-line" aria-hidden="true" />

            <input
              type="search"
              aria-label={`Search ${metadata?.label ?? feature.itemPlural}`}
              placeholder={`Search ${metadata?.label ?? 'records'}…`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            {activeSearch && (
              <button
                type="button"
                className="record-page__search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
                title="Clear search"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            )}

            <button type="submit" className="record-page__search-submit">
              Search
            </button>
          </form>

          {visibleFilterFields.length > 0 && (
            <div className="record-page__filters">
              <span className="record-page__filters-badge" aria-hidden="true">
                <i className="ri-equalizer-2-line" />
                <span>Filters</span>
              </span>

              {visibleFilterFields.map((field) => {
                if (!field) return null

                const fieldname = field.fieldname
                const value = String(activeFilters[fieldname] ?? '')

                const selectOptions = getSelectOptions(
                  'options' in field ? field.options : undefined,
                )

                const linkOptions = linkFilterOptions[fieldname] ?? []

                const selectedLabel =
                  fieldname === 'project'
                    ? queryParams.get('project_label')
                    : fieldname === 'task_id'
                      ? queryParams.get('task_label')
                      : null

                const choices =
                  value && !linkOptions.some(
                    (option) => option.value === value,
                  )
                    ? [
                        {
                          value,
                          label: selectedLabel || value,
                        },
                        ...linkOptions,
                      ]
                    : linkOptions

                return (
                  <div
                    className="record-page__filter-field"
                    key={fieldname}
                  >
                    {field.fieldtype === 'Select' ? (
                      <AppSelect
                        id={`filter-${fieldname}`}
                        label={field.label}
                        value={value}
                        onChange={(nextValue) =>
                          updateFilter(fieldname, nextValue)
                        }
                        placeholder={`All ${field.label}`}
                        options={[
                          {
                            value: '',
                            label: `All ${field.label}`,
                          },
                          ...selectOptions.map((option) => ({
                            value: option,
                            label: option,
                          })),
                        ]}
                      />
                    ) : field.fieldtype === 'Date' ? (
                      <AppDatePicker
                        id={`filter-${fieldname}`}
                        label={field.label}
                        value={value}
                        onChange={(nextValue) =>
                          updateFilter(fieldname, nextValue)
                        }
                        placeholder={field.label}
                        clearable
                      />
                    ) : field.fieldtype === 'Link' ? (
                      <AppCombobox
                        id={`filter-${fieldname}`}
                        label={field.label}
                        value={value}
                        onChange={(nextValue) =>
                          updateFilter(fieldname, nextValue)
                        }
                        placeholder={`All ${field.label}`}
                        options={[
                          {
                            value: '',
                            label: `All ${field.label}`,
                          },
                          ...choices,
                        ]}
                        clearable={true}
                        emptyText={`No ${field.label} found.`}
                      />
                    ) : (
                      <>
                        <label
                          className="sr-only"
                          htmlFor={`filter-${fieldname}`}
                        >
                          {field.label}
                        </label>

                        <input
                          id={`filter-${fieldname}`}
                          type="text"
                          value={value}
                          aria-label={`Filter by ${field.label}`}
                          placeholder={field.label}
                          onChange={(event) =>
                            updateFilter(fieldname, event.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                )
              })}

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="record-page__clear-filters"
                  onClick={clearFilters}
                >
                  <i className="ri-close-line" aria-hidden="true" />
                  Clear ({activeFilterCount})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="record-page__notice" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{actionMessage}</span>
        </div>
      )}

      {metadataError && (
        <div className="record-page__error" role="alert">
          <div>
            <strong>Unable to load column definitions</strong>
            <p>{metadataError}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMetadataLoading(true)
              setMetadataError(null)
              setMetadataRefreshKey((value) => value + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}

      {recordsError && (
        <div className="record-page__error" role="alert">
          <div>
            <strong>Unable to load records</strong>
            <p>{recordsError}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setRecordsRefreshKey((value) => value + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div ref={listContainerRef} className="record-page__content">
        {metadataLoading && !metadata ? (
          <div className="record-page__loading" role="status">
            Loading list configuration…
          </div>
        ) : metadata && isCardFeature ? (
          <div className="record-card-grid">
            {records.map((record) => (
              <RecordCard
                key={record.name}
                feature={feature}
                record={record}
                relatedProjectName={
                  feature.id === 'tasks'
                    ? linkFilterOptions.project?.find(
                        (option) => option.value === String(record.project ?? ''),
                      )?.label
                    : undefined
                }
                canUpdate={metadata.capabilities.can_update}
                updating={editingRecordName !== null}
                isUpdating={editingRecordName === record.name}
                onReadMore={() => {
                  navigate(`/${feature.id}/${encodeURIComponent(record.name)}`)
                }}
                onUpdate={() => setEditingRecordName(record.name)}
                onCardClick={() => {
                  if (feature.id === 'projects') {
                    const projectLabel = String(
                      record.project_name ?? record.name,
                    )

                    navigate(
                      `/tasks?project=${encodeURIComponent(record.name)}&project_label=${encodeURIComponent(projectLabel)}`,
                    )

                    return
                  }

                  if (feature.id === 'tasks') {
                    const taskLabel = String(
                      record.task_name ?? record.name,
                    )
                    const projectId = String(record.project ?? '')
                    const projectLabel =
                      linkFilterOptions.project?.find(
                        (option) => option.value === projectId,
                      )?.label ?? ''
                    const params = new URLSearchParams({
                      task_id: record.name,
                      task_label: taskLabel,
                    })

                    if (projectId) params.set('project_id', projectId)
                    if (projectLabel) params.set('project_label', projectLabel)

                    navigate(`/activity?${params.toString()}`)
                  }
                }}
              />
            ))}

            {recordsLoading && records.length === 0 && (
              <div className="record-page__loading" role="status">
                Loading {feature.itemPlural}…
              </div>
            )}

            {!recordsLoading && records.length === 0 && !recordsError && (
              <div className="record-page__loading">
                {activeSearch || activeFilterCount > 0
                  ? 'No matching records found.'
                  : `No ${feature.itemPlural} found.`}
              </div>
            )}
          </div>
        ) : metadata ? (
          <RecordTable
            fields={metadata.fields}
            records={records}
            loading={recordsLoading}
          />
        ) : null}
      </div>

      <div className="record-page__pagination">
        <span>
          {pagination
            ? `${pagination.returned} record${pagination.returned === 1 ? '' : 's'} on this page`
            : recordsLoading
              ? 'Loading records…'
              : `${records.length} records`}
        </span>

        <div className="record-page__pagination-actions">
          <button
            type="button"
            className="record-page__secondary-button"
            disabled={start === 0 || recordsLoading}
            onClick={() => {
              setStart((value) => Math.max(0, value - PAGE_LENGTH))
            }}
          >
            <i className="ri-arrow-left-line" aria-hidden="true" />
            Previous
          </button>

          <button
            type="button"
            className="record-page__secondary-button"
            disabled={!pagination?.has_more || recordsLoading}
            onClick={() => {
              if (pagination?.next_start == null) return

              setStart(pagination.next_start)
            }}
          >
            Next
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </button>
        </div>
      </div>

      {editingRecordName && (
        <RecordUpdateDialog
          key={`${feature.id}:${editingRecordName}`}
          feature={feature}
          recordName={editingRecordName}
          onClose={() => setEditingRecordName(null)}
          onUpdated={(result) => {
            setEditingRecordName(null)
            setActionMessage(`Record ${result.name} updated successfully.`)
            setRecordsRefreshKey((value) => value + 1)
          }}
        />
      )}
    </section>
  )
}