
import type { FieldMetadata } from '../../services/mementoApi'

import {
  AppDatePicker,
  AppSelect,
} from '../controls'

import {
  RichTextEditor,
  type PendingEditorImage,
} from './RichTextEditor'

import { LinkField } from './LinkField'

interface FieldRendererProps {
  field: FieldMetadata
  value: unknown
  onChange: (value: unknown) => void
  doctype?: string
  docname?: string
  editable?: boolean
  allowPendingImages?: boolean
  onPendingImagesChange?: (images: PendingEditorImage[]) => void
  operation?: 'create' | 'update'
  referenceDoctype?: string
}

const TABLE_FIELD_TYPES = new Set([
  'Table',
  'Table MultiSelect',
])

function displayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2) ?? ''
  }

  return String(value)
}

function isChecked(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function FieldRenderer({
  field,
  value,
  onChange,
  doctype,
  docname,
  editable = true,
  allowPendingImages = false,
  onPendingImagesChange,
  operation = 'create',
  referenceDoctype,
}: FieldRendererProps) {
  if (field.hidden) {
    return null
  }

  const id = `memento-field-${field.fieldname}`
  const valueText = displayValue(value)

  const disabled = !editable || field.read_only
  const required = field.required && !disabled

  const helperText = [
    field.read_only ? 'Read only.' : '',
    field.description ?? '',
  ]
    .filter(Boolean)
    .join(' ') || undefined

  /* ========================================
     Link and Dynamic Link fields
  ======================================== */

  if (
    field.fieldtype === 'Link' ||
    field.fieldtype === 'Dynamic Link'
  ) {
    return (
      <div className="metadata-form__field">
        <label
          className="metadata-form__label"
          htmlFor={id}
        >
          {field.label}

          {required && (
            <span
              className="metadata-form__required"
              aria-hidden="true"
            >
              {' '}*
            </span>
          )}
        </label>

        <LinkField
          id={id}
          sourceDoctype={doctype ?? ''}
          fieldname={field.fieldname}
          value={valueText}
          onChange={onChange}
          operation={operation}
          referenceDoctype={referenceDoctype}
          isDynamicLink={field.fieldtype === 'Dynamic Link'}
          disabled={disabled}
          required={required}
          placeholder={`Search ${field.label.toLowerCase()}…`}
        />

        {field.description && (
          <p className="metadata-form__description">
            {field.description}
          </p>
        )}
      </div>
    )
  }

  /* ========================================
     Rich Text Editor
  ======================================== */

  if (field.fieldtype === 'Text Editor') {
    return (
      <div className="metadata-form__field">
        <label htmlFor={id}>
          <span>
            {field.label}

            {field.required && (
              <span className="metadata-form__required">
                {' '}*
              </span>
            )}

            {field.read_only && (
              <span className="metadata-form__readonly">
                {' '}· Read only
              </span>
            )}
          </span>
        </label>

        <RichTextEditor
          id={id}
          value={valueText}
          onChange={onChange}
          doctype={doctype}
          docname={docname}
          fieldname={field.fieldname}
          editable={!disabled}
          allowPendingImages={allowPendingImages}
          onPendingImagesChange={onPendingImagesChange}
        />

        {field.description && (
          <small
            id={`${id}-help`}
            className="metadata-form__help"
          >
            {field.description}
          </small>
        )}
      </div>
    )
  }

  /* ========================================
     Checkbox
  ======================================== */

  if (field.fieldtype === 'Check') {
    return (
      <div className="metadata-form__field">
        <label
          className="metadata-form__checkbox"
          htmlFor={id}
        >
          <input
            id={id}
            name={field.fieldname}
            type="checkbox"
            checked={isChecked(value)}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.checked ? 1 : 0)
            }
          />

          <span>
            {field.label}

            {field.required && (
              <span className="metadata-form__required">
                {' '}*
              </span>
            )}
          </span>
        </label>

        {field.description && (
          <small className="metadata-form__help">
            {field.description}
          </small>
        )}
      </div>
    )
  }

  /* ========================================
     Select - AppSelect
  ======================================== */

  if (field.fieldtype === 'Select') {
    return (
      <AppSelect
        id={id}
        // className="metadata-form__field"
        label={field.label}
        value={valueText}
        onChange={onChange}
        placeholder={`Select ${field.label}`}
        options={(field.select_options ?? []).map((option) => ({
          value: option,
          label: option,
        }))}
        required={required}
        disabled={disabled}
        helperText={helperText}
      />
    )
  }

  /* ========================================
     Date and Datetime - AppDatePicker
  ======================================== */

  if (
    field.fieldtype === 'Date' ||
    field.fieldtype === 'Datetime'
  ) {
    return (
      <AppDatePicker
        id={id}
        // className="metadata-form__field"
        label={field.label}
        value={valueText}
        onChange={onChange}
        mode={
          field.fieldtype === 'Datetime'
            ? 'datetime'
            : 'date'
        }
        placeholder={
          field.fieldtype === 'Datetime'
            ? 'Select date and time'
            : `Select ${field.label}`
        }
        required={required}
        disabled={disabled}
        clearable={!required}
        helperText={helperText}
      />
    )
  }

  /* ========================================
     Remaining field types
  ======================================== */

  const sharedProps = {
    id,
    name: field.fieldname,
    required,
    disabled,
    'aria-describedby': field.description
      ? `${id}-help`
      : undefined,
  }

  let control

  if (TABLE_FIELD_TYPES.has(field.fieldtype)) {
    control = (
      <textarea
        {...sharedProps}
        value={valueText}
        rows={4}
        spellCheck={false}
        placeholder="[]"
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else if (
    field.fieldtype === 'Text' ||
    field.fieldtype === 'Small Text' ||
    field.fieldtype === 'Code' ||
    field.fieldtype === 'JSON'
  ) {
    control = (
      <textarea
        {...sharedProps}
        value={valueText}
        rows={field.fieldtype === 'Text' ? 3 : 5}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else {
    const typeByField: Record<string, string> = {
      Email: 'email',
      Phone: 'tel',
      Password: 'password',
      Time: 'time',
      Color: 'color',
      Int: 'number',
      Float: 'number',
      Currency: 'number',
      Percent: 'number',
      Rating: 'number',
    }

    const inputType =
      typeByField[field.fieldtype] ?? 'text'

    const inputValue = valueText

    control = (
      <input
        {...sharedProps}
        type={inputType}
        value={
          field.fieldtype === 'Color' && !inputValue
            ? '#000000'
            : inputValue
        }
        step={
          field.fieldtype === 'Int'
            ? 1
            : inputType === 'number'
              ? 'any'
              : undefined
        }
        maxLength={field.length}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        onChange={(event) => {
          const nextValue = event.target.value

          if (
            inputType === 'number' &&
            nextValue !== '' &&
            Number.isFinite(Number(nextValue))
          ) {
            onChange(Number(nextValue))
          } else {
            onChange(nextValue)
          }
        }}
      />
    )
  }

  return (
    <div className="metadata-form__field">
      <label htmlFor={id}>
        <span>
          {field.label}

          {field.required && (
            <span className="metadata-form__required">
              {' '}*
            </span>
          )}

          {field.read_only && (
            <span className="metadata-form__readonly">
              {' '}· Read only
            </span>
          )}
        </span>

        {control}
      </label>

      {field.description && (
        <small
          id={`${id}-help`}
          className="metadata-form__help"
        >
          {field.description}
        </small>
      )}

      {TABLE_FIELD_TYPES.has(field.fieldtype) && (
        <small className="metadata-form__help">
          {/* Child-row structure depends on the linked Frappe DocType. */}
        </small>
      )}
    </div>
  )
}
