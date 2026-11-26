import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import {
  mementoApi,
  type DocTypeMetadata,
  type MementoRecord,
} from '../../services/mementoApi'

import type { FeatureDefinition } from '../home/featureData'
import { RecordUpdateDialog } from '../../components/form/RecordUpdateDialog'

import './RecordDetailsPage.css'

gsap.registerPlugin(ScrollTrigger)

interface RecordDetailPageProps {
  feature: FeatureDefinition
  recordName: string
  onClose: () => void
}

interface DetailField {
  label: string
  value: string
}

function displayText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set'
  }

  if (Array.isArray(value)) {
    const result = value
      .map((item) => displayText(item))
      .filter((item) => item !== 'Not set')

    return result.length ? result.join(', ') : 'Not set'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function plainText(value: unknown): string {
  const text = displayText(value)

  if (text === 'Not set' || typeof document === 'undefined') {
    return text
  }

  const parsed = new DOMParser().parseFromString(text, 'text/html')

  return (parsed.body.textContent ?? text)
    .replace(/\s+/g, ' ')
    .trim() || 'Not set'
}

function formatDate(
  value: unknown,
  includeTime = false,
): string {
  if (typeof value !== 'string' || !value) {
    return 'Not set'
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  )

  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  )

  if (includeTime && hour !== undefined) {
    return `${formattedDate}, ${hour}:${minute ?? '00'}`
  }

  return formattedDate
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

function getDetailIcon(label: string): string {
  const icons: Record<string, string> = {
    'PROJECT ID': 'ri-fingerprint-line',
    'TASK ID': 'ri-fingerprint-line',
    'START DATE': 'ri-calendar-event-line',
    'END DATE': 'ri-calendar-check-line',
    'FROM DATE': 'ri-calendar-event-line',
    'TO DATE': 'ri-calendar-check-line',
    CATEGORY: 'ri-folders-line',
    PRIORITY: 'ri-flag-2-line',
    STATUS: 'ri-pulse-line',
    OWNER: 'ri-user-3-line',
    PROJECT: 'ri-folder-line',
    'CREATED BY': 'ri-user-line',
  }

  return icons[label] ?? 'ri-checkbox-circle-line'
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function scrollToSection(element: HTMLElement | null) {
  if (!element) return

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  element.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  })
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

export function RecordDetailPage({
  feature,
  recordName,
  onClose,
}: RecordDetailPageProps) {
  const [record, setRecord] = useState<MementoRecord | null>(null)
  const [metadata, setMetadata] = useState<DocTypeMetadata | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const rootRef = useRef<HTMLElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const detailSectionRef = useRef<HTMLElement>(null)
  const descriptionSectionRef = useRef<HTMLElement>(null)
  const descriptionContentRef = useRef<HTMLDivElement>(null)
  const readingProgressRef = useRef<HTMLDivElement>(null)
  const topProgressRef = useRef<HTMLDivElement>(null)

  const isProject = feature.id === 'projects'

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      mementoApi.getDocTypeRecord(feature.doctype, recordName),
      mementoApi.getDocTypeMetadata(feature.doctype, 'form'),
    ])
      .then(([recordResponse, metadataResponse]) => {
        if (cancelled) return

        setRecord(recordResponse.data)
        setMetadata(metadataResponse.data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [feature.doctype, recordName, retryKey])

  const recordTitle = record
    ? plainText(isProject ? record.project_name : record.task_name)
    : ''

  const rawDescriptionHtml =
    typeof record?.description === 'string'
      ? record.description
      : ''

  const safeDescriptionHtml = DOMPurify.sanitize(
    rawDescriptionHtml,
    {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['data-width', 'data-align'],
    },
  )

  const description = record
    ? plainText(record.description)
    : 'Not set'

  const wordCount =
    description === 'Not set'
      ? 0
      : description.split(/\s+/).filter(Boolean).length

  const readingMinutes =
    wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0

  const statusValue = record
    ? plainText(record.status)
    : 'Not set'

  const priorityValue = record
    ? plainText(isProject ? record.priority_level : record.priority)
    : 'Not set'

  const authorValue = record
    ? plainText(record.created_by || record.assigned_by || record.owner)
    : 'Not set'

  const publishedDateValue = record
    ? formatDate(record.creation)
    : 'Not set'

  const detailFields: DetailField[] = record
    ? isProject
      ? [
          { label: 'PROJECT ID', value: record.name },
          {
            label: 'START DATE',
            value: formatDate(record.project_start_time || record.start_date),
          },
          {
            label: 'END DATE',
            value: formatDate(record.project_end_time || record.end_date, true),
          },
          {
            label: 'CATEGORY',
            value: plainText(record.category),
          },
          {
            label: 'PRIORITY',
            value: plainText(record.priority_level),
          },
          {
            label: 'STATUS',
            value: plainText(record.status),
          },
          {
            label: 'OWNER',
            value: authorValue,
          },
        ]
      : [
          { label: 'TASK ID', value: record.name },
          {
            label: 'FROM DATE',
            value: formatDate(record.task_start_time || record.from_date, true),
          },
          {
            label: 'TO DATE',
            value: formatDate(record.task_end_time || record.to_date, true),
          },
          {
            label: 'PROJECT',
            value: plainText(record.project),
          },
          {
            label: 'PRIORITY',
            value: plainText(record.priority),
          },
          {
            label: 'STATUS',
            value: plainText(record.status),
          },
          {
            label: 'CREATED BY',
            value: plainText(record.created_by || record.owner),
          },
        ]
    : []

  // GSAP + ScrollTrigger reveal choreography
  useEffect(() => {
    if (loading || !record || !rootRef.current) return

    const root = rootRef.current
    const actionsBar = actionsRef.current
    const hero = headerRef.current
    const descriptionSection = descriptionSectionRef.current
    const detailsSection = detailSectionRef.current

    if (!hero || !descriptionSection || !detailsSection) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (reduceMotion) return

    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({
        defaults: {
          ease: 'power3.out',
        },
      })

      if (actionsBar) {
        heroTimeline.fromTo(
          actionsBar,
          { autoAlpha: 0, y: -10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            clearProps: 'opacity,visibility,transform',
          },
          0,
        )
      }

      heroTimeline
        .fromTo(
          '.record-detail__eyebrow',
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
            clearProps: 'opacity,visibility,transform',
          },
          0.06,
        )
        .fromTo(
          '.record-detail__title-copy h1',
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.52,
            clearProps: 'opacity,visibility,transform',
          },
          0.12,
        )
        .fromTo(
          '.record-detail__byline',
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.44,
            clearProps: 'opacity,visibility,transform',
          },
          0.2,
        )

      gsap.fromTo(
        descriptionSection,
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
          scrollTrigger: {
            trigger: descriptionSection,
            start: 'top 88%',
            once: true,
          },
        },
      )

      const detailFieldEls = gsap.utils.toArray<HTMLElement>(
        '.record-detail__field',
      )

      const detailsTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: detailsSection,
          start: 'top 88%',
          once: true,
        },
      })

      detailsTimeline.fromTo(
        detailsSection.querySelector('.record-detail__section-heading'),
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
      )

      if (detailFieldEls.length > 0) {
        detailsTimeline.fromTo(
          detailFieldEls,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            stagger: 0.055,
            ease: 'power2.out',
            clearProps: 'opacity,visibility,transform',
          },
          '-=0.2',
        )
      }
    }, root)

    return () => {
      context.revert()
    }
  }, [loading, record, recordName])

  // Update reading progress bars smoothly on scroll
  useEffect(() => {
    const section = descriptionSectionRef.current
    const progressBar = readingProgressRef.current
    const topProgressBar = topProgressRef.current

    if (!section) return

    const updateProgress = () => {
      const bounds = section.getBoundingClientRect()
      const totalDistance = bounds.height + window.innerHeight * 0.45
      const travelled = window.innerHeight * 0.65 - bounds.top

      const progress = totalDistance > 0
        ? Math.round(
            Math.max(0, Math.min(100, (travelled / totalDistance) * 100)),
          )
        : 0

      if (progressBar) {
        progressBar.style.width = `${progress}%`
        progressBar.setAttribute('aria-valuenow', String(progress))
      }

      if (topProgressBar) {
        topProgressBar.style.width = `${progress}%`
      }
    }

    updateProgress()

    window.addEventListener('scroll', updateProgress, {
      passive: true,
    })
    window.addEventListener('resize', updateProgress)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [safeDescriptionHtml, recordName])

  // Inject Copy buttons into <pre> code blocks & enable zoom on embedded images
  useEffect(() => {
    const container = descriptionContentRef.current
    if (!container) return

    // 1. Code block Copy buttons
    const preBlocks = Array.from(container.querySelectorAll('pre'))
    const codeCleanups = preBlocks.map((pre) => {
      pre.classList.add('record-detail__code-block')

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'record-detail__code-copy'
      button.setAttribute('aria-label', 'Copy code snippet')
      button.innerHTML =
        '<i class="ri-file-copy-line" aria-hidden="true"></i><span>Copy</span>'

      let resetTimer: number | null = null

      const handleCopy = async () => {
        const codeEl = pre.querySelector('code')
        const rawText = (codeEl?.textContent ?? pre.textContent ?? '').replace(
          /\n$/,
          '',
        )

        const ok = await copyTextToClipboard(rawText)
        if (!ok) return

        button.classList.add('is-copied')
        button.innerHTML =
          '<i class="ri-check-line" aria-hidden="true"></i><span>Copied!</span>'

        if (resetTimer !== null) {
          window.clearTimeout(resetTimer)
        }

        resetTimer = window.setTimeout(() => {
          button.classList.remove('is-copied')
          button.innerHTML =
            '<i class="ri-file-copy-line" aria-hidden="true"></i><span>Copy</span>'
        }, 1800)
      }

      button.addEventListener('click', handleCopy)
      pre.appendChild(button)

      return () => {
        if (resetTimer !== null) {
          window.clearTimeout(resetTimer)
        }
        button.removeEventListener('click', handleCopy)
        button.remove()
      }
    })

    // 2. Embedded image lightbox triggers
    const images = Array.from(container.querySelectorAll('img'))
    const imageCleanups = images.map((image) => {
      const previousTabIndex = image.getAttribute('tabindex')
      const previousRole = image.getAttribute('role')
      const previousLabel = image.getAttribute('aria-label')

      image.setAttribute('tabindex', '0')
      image.setAttribute('role', 'button')
      image.setAttribute(
        'aria-label',
        image.alt.trim()
          ? `Enlarge image: ${image.alt}`
          : 'Enlarge description image',
      )

      const openPreview = () => {
        const source = image.currentSrc || image.src
        if (source) setImagePreview(source)
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPreview()
        }
      }

      image.addEventListener('click', openPreview)
      image.addEventListener('keydown', handleKeyDown)

      return () => {
        image.removeEventListener('click', openPreview)
        image.removeEventListener('keydown', handleKeyDown)

        if (previousTabIndex === null) {
          image.removeAttribute('tabindex')
        } else {
          image.setAttribute('tabindex', previousTabIndex)
        }

        if (previousRole === null) {
          image.removeAttribute('role')
        } else {
          image.setAttribute('role', previousRole)
        }

        if (previousLabel === null) {
          image.removeAttribute('aria-label')
        } else {
          image.setAttribute('aria-label', previousLabel)
        }
      }
    })

    return () => {
      codeCleanups.forEach((cleanup) => cleanup())
      imageCleanups.forEach((cleanup) => cleanup())
    }
  }, [safeDescriptionHtml, loading, recordName])

  // Allow Escape to close an enlarged image.
  useEffect(() => {
    if (!imagePreview) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImagePreview(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [imagePreview])

  if (loading) {
    return (
      <section className="record-detail record-detail--state">
        <div className="record-detail__state-indicator" aria-hidden="true">
          <span />
        </div>
        <p role="status">Preparing your {isProject ? 'project' : 'task'} story…</p>
      </section>
    )
  }

  if (loadError || !record) {
    return (
      <section className="record-detail record-detail--state">
        <button
          type="button"
          className="record-detail__secondary"
          onClick={onClose}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <div className="record-detail__error" role="alert">
          <strong>Unable to open this record</strong>
          <p>{loadError ?? 'The requested record was not found.'}</p>

          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadError(null)
              setRetryKey((value) => value + 1)
            }}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  const displayTitle = recordTitle === 'Not set'
    ? record.name
    : recordTitle

  return (
    <article
      ref={rootRef}
      className="record-detail"
      data-record-type={feature.id}
      aria-labelledby="record-detail-title"
    >
      {/* Subtle fixed reading line across top of viewport */}
      <div className="record-detail__top-progress" aria-hidden="true">
        <div
          ref={topProgressRef}
          className="record-detail__top-progress-fill"
        />
      </div>

      {/* Centered Medium Editorial Column */}
      <div className="record-detail__column">
        <div ref={actionsRef} className="record-detail__actions">
          <button
            type="button"
            className="record-detail__secondary"
            onClick={onClose}
          >
            <i className="ri-arrow-left-line" aria-hidden="true" />
            Back to {feature.itemPlural}
          </button>

          <div className="record-detail__actions-spacer" />

          <button
            type="button"
            className="record-detail__jump-btn"
            onClick={() => scrollToSection(detailSectionRef.current)}
          >
            <i className="ri-information-line" aria-hidden="true" />
            <span>{isProject ? 'Project details' : 'Task details'}</span>
          </button>

          {metadata?.capabilities.can_update && (
            <button
              type="button"
              className="record-detail__update"
              onClick={() => setIsUpdateOpen(true)}
            >
              <i className="ri-edit-line" aria-hidden="true" />
              Edit story
            </button>
          )}
        </div>

        {updateMessage && (
          <div className="record-detail__notice" role="status">
            <i className="ri-checkbox-circle-line" aria-hidden="true" />
            <span>{updateMessage}</span>
            <button
              type="button"
              className="record-detail__notice-dismiss"
              aria-label="Dismiss notification"
              onClick={() => setUpdateMessage(null)}
            >
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Medium-style Article Header */}
        <header
          ref={headerRef}
          className="record-detail__header"
          data-detail-stage="hero"
        >
          <div className="record-detail__eyebrow">
            <span>MEMENTO</span>
            <i className="ri-arrow-right-s-line" aria-hidden="true" />
            <span>{isProject ? 'PROJECT BRIEF' : 'TASK NOTE'}</span>
            <i className="ri-arrow-right-s-line" aria-hidden="true" />
            <span className="record-detail__eyebrow-id">{record.name}</span>
          </div>

          <div className="record-detail__title-copy">
            <h1 id="record-detail-title">{displayTitle}</h1>
          </div>

          {/* Author & Reading Metadata Byline */}
          <div className="record-detail__byline">
            <div className="record-detail__byline-author">
              <span className="record-detail__avatar" aria-hidden="true">
                <i className={isProject ? 'ri-folders-line' : 'ri-task-line'} />
              </span>

              <div className="record-detail__byline-meta">
                <strong>
                  {authorValue !== 'Not set' ? authorValue : 'Memento Workspace'}
                </strong>
                <span>
                  {readingMinutes > 0 ? `${readingMinutes} min read` : 'Quick note'}
                  {wordCount > 0 ? ` · ${wordCount.toLocaleString('en-IN')} words` : ''}
                  {publishedDateValue !== 'Not set' ? ` · ${publishedDateValue}` : ''}
                </span>
              </div>
            </div>

            <div className="record-detail__badges">
              {statusValue !== 'Not set' && (
                <span
                  className={`record-detail__badge record-detail__badge--status record-detail__badge--${slugify(statusValue)}`}
                >
                  <span className="record-detail__badge-dot" aria-hidden="true" />
                  {statusValue}
                </span>
              )}

              {priorityValue !== 'Not set' && (
                <span
                  className={`record-detail__badge record-detail__badge--priority record-detail__badge--${slugify(priorityValue)}`}
                >
                  <i className="ri-flag-2-line" aria-hidden="true" />
                  {priorityValue}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 01 / Medium Editorial Article Body */}
        <section
          ref={descriptionSectionRef}
          className="record-detail__section record-detail__description-section"
          data-detail-stage="description"
          aria-labelledby="record-detail-description-heading"
        >
          <div className="record-detail__reading-card">
            <div className="record-detail__reading-topline">
              <div className="record-detail__reading-label">
                <span className="record-detail__section-index" id="record-detail-description-heading">
                  {isProject ? 'PROJECT DESCRIPTION' : 'TASK DESCRIPTION'}
                </span>
              </div>

              <span className="record-detail__reading-hint">
                <i className="ri-book-open-line" aria-hidden="true" />
                Editorial view
              </span>
            </div>

            <div
              className="record-detail__reading-progress"
              role="progressbar"
              aria-label="Description reading progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={0}
            >
              <div
                ref={readingProgressRef}
                className="record-detail__reading-progress-fill"
              />
            </div>

            {safeDescriptionHtml.trim() && description !== 'Not set' ? (
              <div
                ref={descriptionContentRef}
                className="record-detail__description"
                dangerouslySetInnerHTML={{
                  __html: safeDescriptionHtml,
                }}
              />
            ) : (
              <div className="record-detail__empty-description">
                <span className="record-detail__empty-icon" aria-hidden="true">
                  <i className="ri-quill-pen-line" />
                </span>

                <h3>Nothing written here yet</h3>

                <p>
                  Write a detailed description with headings, code snippets,
                  links, and screenshots for this {isProject ? 'project' : 'task'}.
                </p>

                {metadata?.capabilities.can_update && (
                  <button
                    type="button"
                    className="record-detail__empty-action"
                    onClick={() => setIsUpdateOpen(true)}
                  >
                    <i className="ri-edit-line" aria-hidden="true" />
                    Write description
                  </button>
                )}
              </div>
            )}

            {/* Medium signature three-dot section break */}
            <div className="record-detail__story-break" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="record-detail__reading-footer">
              <span>
                <i className="ri-shield-check-line" aria-hidden="true" />
                End of {isProject ? 'project' : 'task'} description
              </span>

              <button
                type="button"
                onClick={() => scrollToSection(headerRef.current)}
              >
                Back to top
                <i className="ri-arrow-up-line" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* 02 / Record Metadata Appendix */}
        <section
          ref={detailSectionRef}
          className="record-detail__section record-detail__details-section"
          data-detail-stage="details"
          aria-labelledby="record-detail-fields-heading"
        >
          <div className="record-detail__section-heading">
            <div>
              <span className="record-detail__section-index">RECORD METADATA</span>

              <h2 id="record-detail-fields-heading">
                {isProject ? 'Project details' : 'Task details'}
              </h2>

              <p>
                Structured attributes and timeline information attached to this{' '}
                {isProject ? 'project' : 'task'}.
              </p>
            </div>

            <span className="record-detail__section-symbol" aria-hidden="true">
              <i className="ri-layout-grid-line" />
            </span>
          </div>

          <div className="record-detail__grid">
            {detailFields.map((field, index) => (
              <div
                className="record-detail__field"
                key={field.label}
                data-field-index={index}
              >
                <div className="record-detail__field-icon" aria-hidden="true">
                  <i className={getDetailIcon(field.label)} />
                </div>

                <div className="record-detail__field-copy">
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {imagePreview && (
        <div className="record-detail__image-preview">
          <button
            type="button"
            className="record-detail__image-backdrop"
            aria-label="Close image preview"
            onClick={() => setImagePreview(null)}
          />

          <div
            className="record-detail__image-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-detail-image-title"
          >
            <div className="record-detail__image-dialog-header">
              <div>
                <span>IMAGE PREVIEW</span>
                <h2 id="record-detail-image-title">
                  {displayTitle}
                </h2>
              </div>

              <button
                type="button"
                className="record-detail__image-close"
                onClick={() => setImagePreview(null)}
                aria-label="Close image preview"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <img
              src={imagePreview}
              alt={`Description image from ${displayTitle}`}
            />
          </div>
        </div>
      )}

      {isUpdateOpen && (
        <RecordUpdateDialog
          key={`${feature.id}:${recordName}`}
          feature={feature}
          recordName={recordName}
          onClose={() => setIsUpdateOpen(false)}
          onUpdated={(result) => {
            setIsUpdateOpen(false)
            setLoading(true)
            setLoadError(null)
            setUpdateMessage(
              `Record ${result.name} updated successfully.`,
            )
            setRetryKey((value) => value + 1)
          }}
        />
      )}
    </article>
  )
}