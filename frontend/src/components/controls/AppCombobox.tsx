
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

import './AppCombobox.css'

export interface AppComboboxOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface AppComboboxProps {
  value: string
  onChange: (value: string) => void
  options: AppComboboxOption[]

  label?: string
  placeholder?: string
  id?: string
  name?: string

  disabled?: boolean
  required?: boolean
  clearable?: boolean
  loading?: boolean

  error?: string
  helperText?: string
  emptyText?: string

  className?: string
}

export function AppCombobox({
  value,
  onChange,
  options,
  label,
  placeholder = 'Search or select an option',
  id,
  name,
  disabled = false,
  required = false,
  clearable = true,
  loading = false,
  error,
  helperText,
  emptyText = 'No matching options found.',
  className = '',
}: AppComboboxProps) {
  const generatedId = useId()

  const inputId = id ?? `app-combobox-${generatedId}`
  const listId = `${inputId}-listbox`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedOption = options.find(
    (option) => option.value === value,
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    if (!normalizedQuery) return options

    return options.filter((option) => {
      const searchableText = [
        option.label,
        option.value,
        option.description ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [options, query])

  // Close the dropdown when the user clicks outside it.
  useEffect(() => {
    if (!isOpen) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target

      if (
        target instanceof Node &&
        !rootRef.current?.contains(target)
      ) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
      )
    }
  }, [isOpen])

  function openDropdown() {
    if (disabled) return

    setQuery('')
    setActiveIndex(0)
    setIsOpen(true)
  }

  function selectOption(option: AppComboboxOption) {
    if (option.disabled) return

    onChange(option.value)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function clearSelection() {
    onChange('')
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (!isOpen) {
        openDropdown()
        return
      }

      setActiveIndex((current) => {
        let next = current + 1

        while (
          next < filteredOptions.length &&
          filteredOptions[next]?.disabled
        ) {
          next += 1
        }

        return next < filteredOptions.length
          ? next
          : current
      })

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isOpen) {
        openDropdown()
        return
      }

      setActiveIndex((current) => {
        let next = current - 1

        while (
          next >= 0 &&
          filteredOptions[next]?.disabled
        ) {
          next -= 1
        }

        return next >= 0 ? next : current
      })

      return
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault()

      const option = filteredOptions[activeIndex]

      if (option && !option.disabled) {
        selectOption(option)
      }

      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
      setQuery('')
      return
    }

    if (
      event.key === 'Backspace' &&
      !query &&
      clearable &&
      value
    ) {
      clearSelection()
    }
  }

  const displayValue = selectedOption?.label ?? value

  return (
    <div
      ref={rootRef}
      className={[
        'app-combobox',
        isOpen ? 'is-open' : '',
        error ? 'has-error' : '',
        disabled ? 'is-disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <label
          className="app-combobox__label"
          htmlFor={inputId}
        >
          {label}

          {required && (
            <span className="app-combobox__required">
              *
            </span>
          )}
        </label>
      )}

      <div className="app-combobox__control">

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          value={isOpen ? query : displayValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={
            isOpen && filteredOptions.length > 0
              ? `${inputId}-option-${activeIndex}`
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? errorId
              : helperText
                ? helperId
                : undefined
          }
          onFocus={() => {
            if (!isOpen) openDropdown()
          }}
          onClick={() => {
            if (!isOpen) openDropdown()
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        {clearable && value && !disabled && (
          <button
            type="button"
            className="app-combobox__clear"
            aria-label="Clear selection"
            onClick={clearSelection}
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        )}

        <i
          className="ri-arrow-down-s-line app-combobox__arrow"
          aria-hidden="true"
        />
      </div>

      {isOpen && !disabled && (
        <div
          id={listId}
          className="app-combobox__dropdown"
          role="listbox"
          aria-label={label ?? 'Options'}
        >
          {loading ? (
            <div className="app-combobox__message">
              <i className="ri-loader-4-line" aria-hidden="true" />
              Loading options…
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="app-combobox__message">
              {emptyText}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                id={`${inputId}-option-${index}`}
                className={[
                  'app-combobox__option',
                  index === activeIndex ? 'is-active' : '',
                  option.value === value ? 'is-selected' : '',
                  option.disabled ? 'is-disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span className="app-combobox__option-copy">
                  <strong>{option.label}</strong>

                  {option.description && (
                    <small>{option.description}</small>
                  )}
                </span>

                {option.value === value && (
                  <i
                    className="ri-check-line app-combobox__selected-icon"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <p
          className="app-combobox__message app-combobox__message--error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          className="app-combobox__message"
          id={helperId}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
