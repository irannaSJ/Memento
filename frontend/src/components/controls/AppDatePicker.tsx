import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from 'react'

import AirDatepicker, { type AirDatepickerButton } from 'air-datepicker'
import 'air-datepicker/air-datepicker.css'

import './AppDatePicker.css'

export interface AppDatePickerProps {
  value: string
  onChange: (value: string) => void

  mode?: 'date' | 'datetime'
  placement?: 'auto' | 'top' | 'bottom'

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
========================================== */

function parseDate(value: string): Date | null {
  if (!value) return null

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  )

  if (!match) return null

  const [
    ,
    year,
    month,
    day,
    hours = '0',
    minutes = '0',
    seconds = '0',
  ] = match

  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const numericHours = Number(hours)
  const numericMinutes = Number(minutes)
  const numericSeconds = Number(seconds)

  const date = new Date(
    numericYear,
    numericMonth - 1,
    numericDay,
    numericHours,
    numericMinutes,
    numericSeconds,
  )

  if (
    date.getFullYear() !== numericYear ||
    date.getMonth() !== numericMonth - 1 ||
    date.getDate() !== numericDay ||
    date.getHours() !== numericHours ||
    date.getMinutes() !== numericMinutes ||
    date.getSeconds() !== numericSeconds
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

function toDateTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${toDateValue(date)} ${hours}:${minutes}:${seconds}`
}

/* ==========================================
   Display formatting
========================================== */

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDisplayDateTime(date: Date): string {
  const formattedDate = formatDisplayDate(date)
  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  return `${formattedDate}, ${formattedTime}`
}

function getNativePosition(
  input: HTMLInputElement,
  placement: 'auto' | 'top' | 'bottom',
): 'top left' | 'bottom left' {
  if (placement === 'top') return 'top left'
  if (placement === 'bottom') return 'bottom left'

  const rect = input.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  return spaceBelow < 340 && spaceAbove > spaceBelow
    ? 'top left'
    : 'bottom left'
}

/* ==========================================
   AppDatePicker
========================================== */

export function AppDatePicker({
  value,
  onChange,
  mode = 'date',
  placement = 'auto',
  label,
  placeholder,
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

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const datepickerRef = useRef<AirDatepicker | null>(null)
  const isOpenRef = useRef(false)
  const onChangeRef = useRef(onChange)

  const parsedValue = parseDate(value)

  const inputPlaceholder =
    placeholder ??
    (mode === 'datetime'
      ? 'Select date and time'
      : 'Select a date')

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

    const todayButton: AirDatepickerButton = {
      content: 'Today',
      onClick: (dp) => {
        const now = new Date()
        dp.setViewDate(now)
        dp.selectDate(now, { updateTime: true })
        if (mode === 'date') {
          dp.hide()
        }
      },
    }

    const buttons: (AirDatepickerButton | 'clear')[] = clearable
      ? [todayButton, 'clear']
      : [todayButton]

    const datepicker = new AirDatepicker(input, {
      locale: dateLocale,
      firstDay: 1,
      autoClose: mode === 'date',
      keyboardNav: true,
      showEvent: 'click',
      dateFormat: 'dd MMM yyyy',
      timepicker: mode === 'datetime',
      timeFormat: 'hh:mm aa',
      dateTimeSeparator: ', ',
      selectedDates: initialDate ? [initialDate] : [],
      minDate: parseDate(minDate ?? '') ?? false,
      maxDate: parseDate(maxDate ?? '') ?? false,
      buttons,
      position: getNativePosition(input, placement),
      classes: 'memento-air-datepicker',

      onShow: () => {
        isOpenRef.current = true
      },

      onHide: () => {
        isOpenRef.current = false
      },

      onSelect: ({ date }) => {
        const selectedDate = Array.isArray(date) ? date[0] : date

        if (!(selectedDate instanceof Date)) {
          onChangeRef.current('')
          return
        }

        onChangeRef.current(
          mode === 'datetime'
            ? toDateTimeValue(selectedDate)
            : toDateValue(selectedDate),
        )
      },
    })

    datepickerRef.current = datepicker

    const handleDocumentClick = (event: MouseEvent) => {
      if (!isOpenRef.current) return

      const target = event.target as Node | null
      if (!target) return

      const clickedInsideWrapper = wrapperRef.current?.contains(target) ?? false
      const clickedInsideCalendar = datepicker.$datepicker.contains(target)

      if (!clickedInsideWrapper && !clickedInsideCalendar) {
        datepicker.hide()
      }
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
      datepicker.destroy()
      datepickerRef.current = null
      isOpenRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clearable, placement])

  /* ========================================
     Synchronize React value with calendar
  ======================================== */

  useEffect(() => {
    const datepicker = datepickerRef.current
    if (!datepicker) return

    const selectedDate = parseDate(value)

    if (!selectedDate) {
      if (datepicker.selectedDates.length > 0) {
        datepicker.clear({ silent: true })
      }
      return
    }

    const currentDate = datepicker.selectedDates[0]
    const currentValue = currentDate
      ? mode === 'datetime'
        ? toDateTimeValue(currentDate)
        : toDateValue(currentDate)
      : ''

    const nextValue =
      mode === 'datetime'
        ? toDateTimeValue(selectedDate)
        : toDateValue(selectedDate)

    if (currentValue !== nextValue) {
      datepicker.selectDate(selectedDate, {
        silent: true,
        updateTime: true,
      })
    }
  }, [value, mode])

  useEffect(() => {
    datepickerRef.current?.update({
      minDate: parseDate(minDate ?? '') ?? false,
      maxDate: parseDate(maxDate ?? '') ?? false,
    })
  }, [minDate, maxDate])

  useEffect(() => {
    if (disabled) {
      datepickerRef.current?.hide()
    }
  }, [disabled])

  function handlePointerDown() {
    if (disabled || isOpenRef.current) return
    const input = inputRef.current
    const datepicker = datepickerRef.current
    if (!input || !datepicker) return

    datepicker.update({
      position: getNativePosition(input, placement),
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (event.key === 'Escape' && isOpenRef.current) {
      event.preventDefault()
      datepickerRef.current?.hide()
      return
    }

    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()
      handlePointerDown()
      datepickerRef.current?.show()
    }
  }

  const describedBy = error
    ? errorId
    : helperText
      ? helperId
      : undefined

  const displayValue = parsedValue
    ? mode === 'datetime'
      ? formatDisplayDateTime(parsedValue)
      : formatDisplayDate(parsedValue)
    : ''

  return (
    <div
      ref={wrapperRef}
      className={[
        'app-date-picker',
        `app-date-picker--${mode}`,
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
          value={displayValue}
          placeholder={inputPlaceholder}
          readOnly
          disabled={disabled}
          required={required}
          aria-haspopup="dialog"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onPointerDown={handlePointerDown}
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