
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

import {
  mementoApi,
  type LinkOption,
} from '../../services/mementoApi'

import './AppMultiCombobox.css'

interface AppMultiComboboxProps {
  sourceDoctype: string
  fieldname: string
  childFieldname: string
  operation: 'create' | 'update'
  value: string[]
  onChange: (selectedValues: string[]) => void
  disabled?: boolean
  placeholder?: string
  id?: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load options.'
}

export function AppMultiCombobox({
  sourceDoctype,
  fieldname,
  childFieldname,
  operation,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search and select...',
  id,
}: AppMultiComboboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<LinkOption[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // A stable representation of the selected values for effect dependencies.
  const selectedValuesKey = value.join('\u001f')

  // Search Frappe records when the dropdown is open or the search changes.
  useEffect(() => {
    if (
      disabled ||
      !isOpen ||
      !sourceDoctype ||
      !fieldname ||
      !childFieldname
    ) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      void mementoApi
        .searchLinkOptions({
          source_doctype: sourceDoctype,
          fieldname,
          child_fieldname: childFieldname,
          operation,
          search: searchTerm.trim(),
          page_length: 20,
        })
        .then((response) => {
          if (cancelled) return

          const results = response.data ?? []

          setOptions(results)

          setLabels((current) => {
            const next = { ...current }

            for (const option of results) {
              next[option.value] = option.label
            }

            return next
          })

          setActiveIndex(0)
        })
        .catch((requestError: unknown) => {
          if (cancelled) return

          setOptions([])
          setError(getErrorMessage(requestError))
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    sourceDoctype,
    fieldname,
    childFieldname,
    operation,
    searchTerm,
    isOpen,
    disabled,
  ])

  // Resolve labels for previously saved selections in update mode.
  useEffect(() => {
    const selectedValues = selectedValuesKey
      ? selectedValuesKey.split('\u001f').filter(Boolean)
      : []

    const missingValues = selectedValues.filter(
      (selectedValue) => !labels[selectedValue],
    )

    if (
      missingValues.length === 0 ||
      !sourceDoctype ||
      !fieldname ||
      !childFieldname
    ) {
      return
    }

    let cancelled = false

    async function loadSelectedLabels() {
      const results = await Promise.all(
        missingValues.map(async (selectedValue) => {
          const response = await mementoApi.searchLinkOptions({
            source_doctype: sourceDoctype,
            fieldname,
            child_fieldname: childFieldname,
            operation,
            search: selectedValue,
            page_length: 20,
          })

          return response.data?.find(
            (option) => option.value === selectedValue,
          )
        }),
      )

      if (cancelled) return

      setLabels((current) => {
        const next = { ...current }

        for (const option of results) {
          if (option) {
            next[option.value] = option.label
          }
        }

        return next
      })
    }

    void loadSelectedLabels().catch(() => {
      // The record name remains available as a fallback label.
    })

    return () => {
      cancelled = true
    }
  }, [
    selectedValuesKey,
    labels,
    sourceDoctype,
    fieldname,
    childFieldname,
    operation,
  ])

  const visibleOptions = options.filter(
    (option) => !value.includes(option.value),
  )

  function selectOption(option: LinkOption) {
    if (value.includes(option.value)) return

    setLabels((current) => ({
      ...current,
      [option.value]: option.label,
    }))

    onChange([...value, option.value])

    setSearchTerm('')
    setActiveIndex(0)
    setError(null)
    setIsOpen(true)

    inputRef.current?.focus()
  }

  function removeOption(selectedValue: string) {
    onChange(
      value.filter(
        (currentValue) => currentValue !== selectedValue,
      ),
    )

    inputRef.current?.focus()
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value)
    setActiveIndex(0)
    setIsOpen(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)

      setActiveIndex((current) =>
        Math.min(current + 1, visibleOptions.length - 1),
      )

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      setActiveIndex((current) =>
        Math.max(current - 1, 0),
      )

      return
    }

    if (
      event.key === 'Enter' &&
      isOpen &&
      visibleOptions.length > 0
    ) {
      event.preventDefault()
      selectOption(
        visibleOptions[activeIndex] ?? visibleOptions[0],
      )
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (
      event.key === 'Backspace' &&
      !searchTerm &&
      value.length > 0
    ) {
      removeOption(value[value.length - 1])
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        setIsOpen(false)
      }
    }, 100)
  }

  return (
    <div
      ref={wrapperRef}
      className={`app-multi-combobox ${
        disabled ? 'app-multi-combobox--disabled' : ''
      }`}
      onBlur={handleBlur}
    >
      <div
        className="app-multi-combobox__control"
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        {value.map((selectedValue) => (
          <span
            className="app-multi-combobox__chip"
            key={selectedValue}
          >
            <span className="app-multi-combobox__chip-label">
              {labels[selectedValue] ?? selectedValue}
            </span>

            {!disabled && (
              <button
                type="button"
                className="app-multi-combobox__remove"
                aria-label={`Remove ${
                  labels[selectedValue] ?? selectedValue
                }`}
                onClick={(event) => {
                  event.stopPropagation()
                  removeOption(selectedValue)
                }}
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="app-multi-combobox__input"
            value={searchTerm}
            placeholder={
              value.length > 0 ? 'Add another...' : placeholder
            }
            onFocus={() => setIsOpen(true)}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-expanded={isOpen}
            aria-autocomplete="list"
          />
        )}
      </div>

      {isOpen && !disabled && (
        <div className="app-multi-combobox__dropdown">
          {loading && (
            <div className="app-multi-combobox__message">
              Searching...
            </div>
          )}

          {!loading && error && (
            <div
              className="app-multi-combobox__message app-multi-combobox__error"
              role="alert"
            >
              {error}
            </div>
          )}

          {!loading && !error && visibleOptions.length === 0 && (
            <div className="app-multi-combobox__message">
              {options.length > 0
                ? 'All matching users are already selected.'
                : searchTerm
                  ? 'No matching records found.'
                  : 'No records available.'}
            </div>
          )}

          {!loading &&
            !error &&
            visibleOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                className={`app-multi-combobox__option ${
                  index === activeIndex
                    ? 'app-multi-combobox__option--active'
                    : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="app-multi-combobox__option-label">
                  {option.label}
                </span>

                {option.label !== option.value && (
                  <span className="app-multi-combobox__option-value">
                    {option.value}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
