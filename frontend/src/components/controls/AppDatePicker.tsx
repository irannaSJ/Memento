
import { useEffect, useId, useRef } from 'react'

import AirDatepicker from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'

import './AppDatePicker.css'

export interface AppDatePickerProps {
  value: string
  onChange: (value: string) => void

  label?: string
  placeholder?: string
  id?: string
  name?: string

  minDate?: string
  maxDate?: string

  disabled?: boolean
  required?: boolean
  clearable?: boolean

  error?: string
  helperText?: string

  className?: string
}

/* ==========================================
   Calendar localization
========================================== */

const dateLocale = {
  days: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],

  daysShort: [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ],

  daysMin: [
    'Su',
    'Mo',
    'Tu',
    'We',
    'Th',
    'Fr',
    'Sa',
  ],

  months: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],

  monthsShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],

  today: 'Today',
  clear: 'Clear',
  dateFormat: 'dd MMM yyyy',
  timeFormat: 'hh:mm aa',
  firstDay: 1 as const,
}

/* ==========================================
   Date utilities

   Input/output format:
   YYYY-MM-DD (Frappe-compatible)
========================================== */

function parseDate(value: string): Date | null {
  if (!value) return null

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const [, year, month, day] = match

  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)

  const date = new Date(
    numericYear,
    numericMonth - 1,
    numericDay,
  )

  // Reject invalid dates such as 2026-02-30.
  if (
    date.getFullYear() !== numericYear ||
    date.getMonth() !== numericMonth - 1 ||
    date.getDate() !== numericDay
  ) {
    return null
  }

  return date
}

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/* ==========================================
   AppDatePicker component
========================================== */

export function AppDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select a date',
  id,
  name,
  minDate,
  maxDate,
  disabled = false,
  required = false,
  clearable = true,
  error,
  helperText,
  className = '',
}: AppDatePickerProps) {
  const generatedId = useId()

  const inputId = id ?? `app-date-${generatedId}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  const inputRef = useRef<HTMLInputElement>(null)

  const datepickerRef = useRef<AirDatepicker | null>(null)

  const onChangeRef = useRef(onChange)

  const parsedValue = parseDate(value)

  /* ========================================
     Keep the latest React callback
  ======================================== */

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  /* ========================================
     Initialize Air Datepicker
  ======================================== */

  useEffect(() => {
    const input = inputRef.current

    if (!input) return

    const initialDate = parseDate(value)

    const datepicker = new AirDatepicker(input, {
      locale: dateLocale,

      firstDay: 1,

      autoClose: true,
      keyboardNav: true,

      showEvent: 'click',

      dateFormat: (date: Date) => formatDisplayDate(date),

      selectedDates: initialDate
        ? [initialDate]
        : [],

      minDate: parseDate(minDate ?? '') ?? false,

      maxDate: parseDate(maxDate ?? '') ?? false,

      buttons: clearable
        ? ['today', 'clear']
        : ['today'],

      position: 'bottom left',

      classes: 'memento-air-datepicker',

      onSelect: ({ date }) => {
        const selectedDate = Array.isArray(date)
          ? date[0]
          : date

        onChangeRef.current(
          selectedDate instanceof Date
            ? toDateValue(selectedDate)
            : '',
        )
      },
    })

    datepickerRef.current = datepicker

    return () => {
      datepicker.destroy()
      datepickerRef.current = null
    }

    // Initialize the calendar once.
    // React value changes are synchronized in a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ========================================
     Synchronize external React value
  ======================================== */

  useEffect(() => {
    const datepicker = datepickerRef.current

    if (!datepicker) return

    const selectedDate = parseDate(value)

    if (!selectedDate) {
      if (datepicker.selectedDates.length > 0) {
        datepicker.clear({
          silent: true,
        })
      }

      return
    }

    const currentDate = datepicker.selectedDates[0]

    if (
      !currentDate ||
      toDateValue(currentDate) !== toDateValue(selectedDate)
    ) {
      datepicker.selectDate(selectedDate, {
        silent: true,
      })
    }
  }, [value])

  /* ========================================
     Update calendar options dynamically
  ======================================== */

  useEffect(() => {
    const datepicker = datepickerRef.current

    if (!datepicker) return

    datepicker.update({
      minDate: parseDate(minDate ?? '') ?? false,

      maxDate: parseDate(maxDate ?? '') ?? false,

      buttons: clearable
        ? ['today', 'clear']
        : ['today'],
    })
  }, [minDate, maxDate, clearable])

  /* ========================================
     Keyboard accessibility
  ======================================== */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (disabled) return

    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()
      datepickerRef.current?.show()
    }
  }

  /* ========================================
     Render
  ======================================== */

  const describedBy = error
    ? errorId
    : helperText
      ? helperId
      : undefined

  return (
    <div
      className={[
        'app-date-picker',
        error ? 'has-error' : '',
        disabled ? 'is-disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <label
          className="app-date-picker__label"
          htmlFor={inputId}
        >
          {label}

          {required && (
            <span className="app-date-picker__required">
              *
            </span>
          )}
        </label>
      )}

      <div className="app-date-picker__control">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          value={
            parsedValue
              ? formatDisplayDate(parsedValue)
              : ''
          }
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          required={required}
          aria-label={!label ? placeholder : undefined}
          aria-haspopup="dialog"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onKeyDown={handleKeyDown}
        />

        <i
          className="ri-calendar-line app-date-picker__icon"
          aria-hidden="true"
        />
      </div>

      {error && (
        <p
          className="app-date-picker__message app-date-picker__message--error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          className="app-date-picker__message"
          id={helperId}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
