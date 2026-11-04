
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import './AppSelect.css'

export interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options: AppSelectOption[]

  label?: string
  placeholder?: string
  id?: string
  name?: string

  disabled?: boolean
  required?: boolean

  error?: string
  helperText?: string

  className?: string
}

interface MenuPosition {
  top: number
  left: number
  width: number
  maxHeight: number
}

function getMenuPosition(
  trigger: HTMLElement,
  optionCount: number,
): MenuPosition {
  const rect = trigger.getBoundingClientRect()

  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  const gap = 6
  const edge = 8

  const desiredHeight = Math.min(
    280,
    Math.max(48, optionCount * 42 + 12),
  )

  const spaceBelow = Math.max(
    0,
    viewportHeight - rect.bottom - edge - gap,
  )

  const spaceAbove = Math.max(
    0,
    rect.top - edge - gap,
  )

  const openBelow =
    spaceBelow >= Math.min(desiredHeight, 160) ||
    spaceBelow >= spaceAbove

  const availableHeight = openBelow
    ? spaceBelow
    : spaceAbove

  const maxHeight = Math.min(
    desiredHeight,
    Math.max(100, availableHeight),
  )

  const width = Math.min(
    rect.width,
    viewportWidth - edge * 2,
  )

  const left = Math.min(
    Math.max(edge, rect.left),
    viewportWidth - width - edge,
  )

  const top = openBelow
    ? rect.bottom + gap
    : rect.top - maxHeight - gap

  return {
    top: Math.max(edge, top),
    left,
    width,
    maxHeight,
  }
}

export function AppSelect({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select an option',
  id,
  name,
  disabled = false,
  required = false,
  error,
  helperText,
  className = '',
}: AppSelectProps) {
  const generatedId = useId()

  const selectId = id ?? `app-select-${generatedId}`
  const triggerId = `${selectId}-trigger`
  const labelId = `${selectId}-label`
  const listId = `${selectId}-listbox`
  const errorId = `${selectId}-error`
  const helperId = `${selectId}-helper`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPosition, setMenuPosition] =
    useState<MenuPosition | null>(null)

  const selectedOption = options.find(
    (option) => option.value === value,
  )

  const selectedIndex = options.findIndex(
    (option) => option.value === value,
  )

  const describedBy = error
    ? errorId
    : helperText
      ? helperId
      : undefined


  const isDropdownOpen = isOpen && !disabled

  function getFirstEnabledIndex(): number {
    return options.findIndex((option) => !option.disabled)
  }

  function getLastEnabledIndex(): number {
    for (let index = options.length - 1; index >= 0; index--) {
      if (!options[index]?.disabled) {
        return index
      }
    }

    return -1
  }

  function getInitialActiveIndex(): number {
    if (
      selectedIndex >= 0 &&
      !options[selectedIndex]?.disabled
    ) {
      return selectedIndex
    }

    return getFirstEnabledIndex()
  }

  function openDropdown() {
    if (disabled) return

    const trigger = triggerRef.current

    if (!trigger) return

    setActiveIndex(getInitialActiveIndex())
    setMenuPosition(
      getMenuPosition(trigger, options.length),
    )
    setIsOpen(true)
  }

  function closeDropdown(returnFocus = false) {
    setIsOpen(false)
    setMenuPosition(null)

    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }

  function selectOption(option: AppSelectOption) {
    if (option.disabled) return

    onChange(option.value)
    closeDropdown(true)
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (options.length === 0) return

    let index = activeIndex

    for (let count = 0; count < options.length; count++) {
      index += direction

      if (index >= options.length) {
        index = 0
      }

      if (index < 0) {
        index = options.length - 1
      }

      if (!options[index]?.disabled) {
        setActiveIndex(index)
        return
      }
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()

        if (!isOpen) {
          openDropdown()
        } else {
          moveActiveIndex(1)
        }
        break

      case 'ArrowUp':
        event.preventDefault()

        if (!isOpen) {
          openDropdown()
        } else {
          moveActiveIndex(-1)
        }
        break

      case 'Home':
        if (isOpen) {
          event.preventDefault()
          setActiveIndex(getFirstEnabledIndex())
        }
        break

      case 'End':
        if (isOpen) {
          event.preventDefault()
          setActiveIndex(getLastEnabledIndex())
        }
        break

      case 'Enter':
      case ' ':
        event.preventDefault()

        if (!isOpen) {
          openDropdown()
        } else {
          const option = options[activeIndex]

          if (option) {
            selectOption(option)
          }
        }
        break

      case 'Escape':
        if (isOpen) {
          event.preventDefault()
          closeDropdown(true)
        }
        break

      case 'Tab':
        if (isOpen) {
          closeDropdown()
        }
        break
    }
  }

  // Close when clicking outside the trigger and popup.
  useEffect(() => {
    if (!isDropdownOpen) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) return

      const clickedTrigger =
        rootRef.current?.contains(target)

      const clickedMenu =
        menuRef.current?.contains(target)

      if (!clickedTrigger && !clickedMenu) {
        closeDropdown()
      }
    }

    function updatePosition() {
      const trigger = triggerRef.current

      if (!trigger) return

      setMenuPosition(
        getMenuPosition(trigger, options.length),
      )
    }

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown,
    )

    document.addEventListener(
      'scroll',
      updatePosition,
      true,
    )

    window.addEventListener('resize', updatePosition)

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
      )

      document.removeEventListener(
        'scroll',
        updatePosition,
        true,
      )

      window.removeEventListener('resize', updatePosition)
    }
  }, [isDropdownOpen, options.length])

  // Keep the active option visible during keyboard navigation.
  useEffect(() => {
    if (!isDropdownOpen || activeIndex < 0) return

    const activeOption = document.getElementById(
      `${selectId}-option-${activeIndex}`,
    )

    activeOption?.scrollIntoView({
      block: 'nearest',
    })
  }, [isDropdownOpen, activeIndex, selectId])

  // Close the popup when this control becomes disabled.
//   useEffect(() => {
//     if (disabled) {
//       setIsOpen(false)
//       setMenuPosition(null)
//     }
//   }, [disabled])

  return (
    <div
      ref={rootRef}
      className={[
        'app-select',
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
          id={labelId}
          className="app-select__label"
          htmlFor={triggerId}
        >
          {label}

          {required && (
            <span className="app-select__required">
              *
            </span>
          )}
        </label>
      )}

      {/*
        Keep a visually hidden native select for
        form submission and HTML required validation.
        The visible dropdown is completely custom.
      */}
      {name && (
        <select
          id={selectId}
          className="app-select__native"
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="app-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-controls={listId}
        aria-labelledby={
          label
            ? `${labelId} ${triggerId}`
            : undefined
        }
        aria-label={
          label
            ? undefined
            : selectedOption?.label || placeholder
        }
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onClick={() => {
          if (isDropdownOpen) {
            closeDropdown()
          } else {
            openDropdown()
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span
          className={[
            'app-select__value',
            !selectedOption ? 'is-placeholder' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {selectedOption?.label || placeholder}
        </span>

        <i
          className={[
            'ri-arrow-down-s-line',
            'app-select__icon',
            isDropdownOpen ? 'is-rotated' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>

      {isDropdownOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          id={listId}
          className="app-select__dropdown"
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          } satisfies CSSProperties}
        >
          {options.length === 0 ? (
            <div className="app-select__empty">
              No options available.
            </div>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === activeIndex

              return (
                <button
                  key={option.value}
                  id={`${selectId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  tabIndex={-1}
                  disabled={option.disabled}
                  className={[
                    'app-select__option',
                    isSelected ? 'is-selected' : '',
                    isActive ? 'is-active' : '',
                    option.disabled ? 'is-disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => {
                    if (!option.disabled) {
                      setActiveIndex(index)
                    }
                  }}
                  onClick={() => selectOption(option)}
                >
                  <span>{option.label}</span>

                  {isSelected && (
                    <i
                      className="ri-check-line app-select__check"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })
          )}
        </div>,
        document.body,
      )}

      {error && (
        <p
          className="app-select__message app-select__message--error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          className="app-select__message"
          id={helperId}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
