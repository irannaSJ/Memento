import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { MetadataDrivenForm } from '../../components/form/MetadataDrivenForm'
import type { FeatureDefinition } from '../home/featureData'
import './RecordCreatePage.css'

interface RecordCreatePageProps {
  feature: FeatureDefinition
  onCancel: () => void
  onCreated: () => void
}

export function RecordCreatePage({
  feature,
  onCancel,
  onCreated,
}: RecordCreatePageProps) {
  const rootRef = useRef<HTMLElement>(null)

  const isProject = feature.id === 'projects'

  const recordLabel = isProject
    ? 'project'
    : feature.id === 'tasks'
      ? 'task'
      : feature.id === 'todo'
        ? 'to-do item'
        : 'activity entry'

  useEffect(() => {
    const root = rootRef.current
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
          '.record-create-page__back',
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
          '.record-create-page__eyebrow',
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.36,
            clearProps: 'opacity,visibility,transform',
          },
          0.05,
        )
        .fromTo(
          '.record-create-page__icon',
          { autoAlpha: 0, scale: 0.88, rotate: -6 },
          {
            autoAlpha: 1,
            scale: 1,
            rotate: 0,
            duration: 0.45,
            ease: 'back.out(1.4)',
            clearProps: 'opacity,visibility,transform',
          },
          0.08,
        )
        .fromTo(
          '.record-create-page__title-copy > *',
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
            stagger: 0.05,
            clearProps: 'opacity,visibility,transform',
          },
          0.12,
        )
        .fromTo(
          '.record-create-page__form-card',
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.48,
            clearProps: 'opacity,visibility,transform',
          },
          0.18,
        )
    }, root)

    return () => context.revert()
  }, [feature.id])

  return (
    <main
      ref={rootRef}
      className="record-create-page"
      aria-labelledby="record-create-title"
    >
      <div className="record-create-page__container">
        <button
          type="button"
          className="record-create-page__back"
          onClick={onCancel}
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to {feature.itemPlural}
        </button>

        <header className="record-create-page__header">
          <span className="record-create-page__eyebrow">
            MEMENTO / WORKSPACE / CREATE
          </span>

          <div className="record-create-page__title-row">
            <div className="record-create-page__icon" aria-hidden="true">
              <i className={feature.icon} />
            </div>

            <div className="record-create-page__title-copy">
              <h1 id="record-create-title">
                Create {recordLabel}
              </h1>

              <p>
                Add a new {recordLabel} to your workspace.
                Complete the details below and save your record.
              </p>
            </div>
          </div>
        </header>

        <section
          className="record-create-page__form-card"
          aria-label={`${recordLabel} information`}
        >
          <div className="record-create-page__form-heading">
            <div>
              <span className="record-create-page__section-label">
                NEW RECORD
              </span>

              <h2>
                {isProject
                  ? 'Project information'
                  : `${recordLabel.charAt(0).toUpperCase()}${recordLabel.slice(1)} information`}
              </h2>
            </div>

            <span className="record-create-page__form-icon" aria-hidden="true">
              <i className="ri-file-list-3-line" />
            </span>
          </div>

          <div className="record-create-page__form-body">
            <MetadataDrivenForm
              doctype={feature.doctype}
              mode="create"
              onCancel={onCancel}
              onSuccess={() => onCreated()}
            />
          </div>
        </section>
      </div>
    </main>
  )
}