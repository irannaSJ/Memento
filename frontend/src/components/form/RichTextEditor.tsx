import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'

import { EditorContent, useEditor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import DOMPurify from 'dompurify'

import { mementoApi } from '../../services/mementoApi'

import './RichTextEditor.css'

export interface PendingEditorImage {
  fieldname: string
  file: File
  previewUrl: string
}

type ImageWidthPreset = 'small' | 'medium' | 'wide' | 'full'
type ImageAlignPreset = 'left' | 'center' | 'right'

interface FloatingPopoverState {
  kind: 'text' | 'image'
  top: number
  rawCenterX: number
  placeBelow: boolean
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  doctype?: string
  docname?: string
  id?: string
  editable?: boolean
  fieldname?: string
  allowPendingImages?: boolean
  onPendingImagesChange?: (images: PendingEditorImage[]) => void
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const ResizableAlignedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 'wide',
        parseHTML: (element) =>
          element.getAttribute('data-width') || 'wide',
        renderHTML: (attributes) => ({
          'data-width': attributes.width || 'wide',
        }),
      },
      align: {
        default: 'center',
        parseHTML: (element) =>
          element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.align || 'center',
        }),
      },
    }
  },
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeEditorContent(value: string): string {
  if (!value.trim()) {
    return '<p></p>'
  }

  const hasHtml = /<\/?[a-z][^>]*>/i.test(value)

  const html = hasHtml
    ? value
    : `<p>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['data-width', 'data-align'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`rich-text-editor__tool${active ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  doctype,
  docname,
  id,
  editable = true,
  fieldname,
  allowPendingImages = false,
  onPendingImagesChange,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImageUrlsRef = useRef<string[]>([])

  const [pendingImages, setPendingImages] =
    useState<PendingEditorImage[]>([])

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [floatingPopover, setFloatingPopover] =
    useState<FloatingPopoverState | null>(null)
  const [clampedLeft, setClampedLeft] = useState<number | null>(null)
  const [, setSelectionVersion] = useState(0)

  const canUploadImage = Boolean(doctype?.trim() && docname?.trim())

  const canAddImage =
    editable &&
    (canUploadImage || (allowPendingImages && Boolean(fieldname)))

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ResizableAlignedImage.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'rich-text-editor__image',
        },
      }),
    ],
    content: normalizeEditorContent(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'rich-text-editor__content',
        'aria-label': 'Rich-text description',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML())
    },
    onSelectionUpdate: () => {
      setSelectionVersion((v) => v + 1)
    },
  })

  const updateFloatingPosition = useCallback(() => {
    const container = containerRef.current
    if (!editor || !container || !editable) {
      setFloatingPopover(null)
      return
    }

    const { selection } = editor.state
    const containerRect = container.getBoundingClientRect()
    const toolbarHeight = toolbarRef.current?.offsetHeight ?? 48

    // 1. Image NodeSelection -> anchor directly above/on the selected image
    if (
      selection instanceof NodeSelection &&
      selection.node.type.name === 'image'
    ) {
      const domNode = editor.view.nodeDOM(selection.from)
      if (!(domNode instanceof HTMLElement)) {
        setFloatingPopover(null)
        return
      }

      const imgRect = domNode.getBoundingClientRect()
      const centerX =
        imgRect.left - containerRect.left + imgRect.width / 2
      const topOffset = imgRect.top - containerRect.top
      const placeBelow = topOffset < toolbarHeight + 54

      setFloatingPopover({
        kind: 'image',
        top: placeBelow
          ? Math.max(toolbarHeight + 8, topOffset + 12)
          : Math.max(toolbarHeight + 8, topOffset - 10),
        rawCenterX: centerX,
        placeBelow,
      })
      return
    }

    // 2. Non-empty text selection -> anchor right above the highlighted text
    if (!selection.empty) {
      try {
        const startCoords = editor.view.coordsAtPos(selection.from)
        const endCoords = editor.view.coordsAtPos(selection.to)

        const selTop = Math.min(startCoords.top, endCoords.top)
        const selBottom = Math.max(startCoords.bottom, endCoords.bottom)
        const selCenterX =
          (startCoords.left + endCoords.right) / 2 - containerRect.left

        const topOffset = selTop - containerRect.top
        const placeBelow = topOffset < toolbarHeight + 54

        setFloatingPopover({
          kind: 'text',
          top: placeBelow
            ? selBottom - containerRect.top + 10
            : Math.max(toolbarHeight + 8, topOffset - 10),
          rawCenterX: selCenterX,
          placeBelow,
        })
        return
      } catch {
        setFloatingPopover(null)
        return
      }
    }

    setFloatingPopover(null)
  }, [editor, editable])

  // Clamp horizontal position using the popover's real rendered width so edges never clip
  useLayoutEffect(() => {
    const container = containerRef.current
    const popoverEl = floatingRef.current

    if (!floatingPopover || !container || !popoverEl) {
      setClampedLeft(null)
      return
    }

    const containerWidth = container.clientWidth
    const popoverWidth = popoverEl.offsetWidth
    const edgePadding = 12
    const halfWidth = popoverWidth / 2

    if (popoverWidth + edgePadding * 2 >= containerWidth) {
      setClampedLeft(containerWidth / 2)
      return
    }

    const minCenter = halfWidth + edgePadding
    const maxCenter = containerWidth - halfWidth - edgePadding
    const nextLeft = Math.max(
      minCenter,
      Math.min(maxCenter, floatingPopover.rawCenterX),
    )

    setClampedLeft(nextLeft)
  }, [floatingPopover])

  useEffect(() => {
    if (!editor) return

    const sync = () => {
      requestAnimationFrame(updateFloatingPosition)
    }

    sync()

    editor.on('selectionUpdate', sync)
    editor.on('update', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)

    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('update', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [editor, updateFloatingPosition])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return

    const nextContent = normalizeEditorContent(value)

    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, {
        emitUpdate: false,
      })
    }
  }, [editor, value])

  useEffect(() => {
    const previewUrls = pendingImageUrlsRef.current

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      previewUrls.length = 0
    }
  }, [])

  function moveSelectedImage(direction: 'up' | 'down') {
    if (!editor || !editable) return

    const { state, view } = editor
    const { selection, doc } = state

    if (
      !(selection instanceof NodeSelection) ||
      selection.node.type.name !== 'image'
    ) {
      return
    }

    const from = selection.from
    const to = selection.to
    const node = selection.node
    const $from = selection.$from
    const topIndex = $from.index(0)

    if (direction === 'up') {
      if (topIndex <= 0) return

      let prevStart = 0
      for (let i = 0; i < topIndex - 1; i += 1) {
        prevStart += doc.child(i).nodeSize
      }

      const tr = state.tr
        .delete(from, to)
        .insert(prevStart, node)

      tr.setSelection(NodeSelection.create(tr.doc, prevStart))
      view.dispatch(tr.scrollIntoView())
      return
    }

    if (topIndex >= doc.childCount - 1) return

    const nextNode = doc.child(topIndex + 1)
    const targetPosAfterDelete = from + nextNode.nodeSize

    const tr = state.tr
      .delete(from, to)
      .insert(targetPosAfterDelete, node)

    tr.setSelection(NodeSelection.create(tr.doc, targetPosAfterDelete))
    view.dispatch(tr.scrollIntoView())
  }

  async function handleImageSelected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !editor || !editable) return

    setUploadError(null)
    setUploadMessage(null)

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setUploadError('Choose a PNG, JPEG, WebP, or GIF image.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('Images must be 5 MB or smaller.')
      return
    }

    if (!canUploadImage) {
      if (!allowPendingImages || !fieldname) {
        setUploadError(
          'Save the record first, then open Update to upload images.',
        )
        return
      }

      const previewUrl = URL.createObjectURL(file)
      pendingImageUrlsRef.current.push(previewUrl)

      const nextImages: PendingEditorImage[] = [
        ...pendingImages,
        {
          fieldname,
          file,
          previewUrl,
        },
      ]

      setPendingImages(nextImages)
      onPendingImagesChange?.(nextImages)

      editor
        .chain()
        .focus()
        .setImage({
          src: previewUrl,
          alt: file.name,
          title: file.name,
        })
        .run()

      setUploadMessage(
        'Image added. Click the image to resize or reposition it.',
      )

      return
    }

    if (!doctype || !docname) return

    setUploading(true)

    try {
      const uploadedFile = await mementoApi.uploadFile(file, {
        doctype,
        docname,
      })

      editor
        .chain()
        .focus()
        .setImage({
          src: uploadedFile.file_url,
          alt: file.name,
          title: file.name,
        })
        .run()

      setUploadMessage('Image uploaded. Click it to resize or reposition.')
    } catch (error: unknown) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Unable to upload the image.',
      )
    } finally {
      setUploading(false)
    }
  }

  function insertLink() {
    if (!editor || !editable) return

    const currentUrl = editor.getAttributes('link').href as
      | string
      | undefined

    const url = window.prompt(
      'Enter the link URL',
      currentUrl ?? 'https://',
    )

    if (url === null) return

    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .unsetLink()
        .run()

      return
    }

    try {
      const parsedUrl = new URL(trimmedUrl)

      if (
        !['https:', 'http:', 'mailto:'].includes(parsedUrl.protocol)
      ) {
        setUploadError('Use an HTTP, HTTPS, or email link.')
        return
      }

      setUploadError(null)

      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: trimmedUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
        })
        .run()
    } catch {
      setUploadError('Enter a valid link URL.')
    }
  }

  if (!editor) {
    return (
      <div className="rich-text-editor__loading" role="status">
        Preparing rich-text editor…
      </div>
    )
  }

  const isImageSelected = editable && editor.isActive('image')
  const imageAttrs = isImageSelected ? editor.getAttributes('image') : {}
  const activeWidth = (imageAttrs.width as ImageWidthPreset) || 'wide'
  const activeAlign = (imageAttrs.align as ImageAlignPreset) || 'center'

  let canMoveImageUp = false
  let canMoveImageDown = false
  if (isImageSelected && editor.state.selection instanceof NodeSelection) {
    const topIndex = editor.state.selection.$from.index(0)
    canMoveImageUp = topIndex > 0
    canMoveImageDown = topIndex < editor.state.doc.childCount - 1
  }

  return (
    <div ref={containerRef} className="rich-text-editor">
      {editable && (
        <div
          ref={toolbarRef}
          className="rich-text-editor__toolbar"
          role="toolbar"
          aria-label="Description formatting"
        >
          <ToolbarButton
            label="Paragraph"
            active={editor.isActive('paragraph')}
            onClick={() =>
              editor.chain().focus().setParagraph().run()
            }
          >
            P
          </ToolbarButton>

          {[1, 2, 3].map((level) => (
            <ToolbarButton
              key={level}
              label={`Heading ${level}`}
              active={editor.isActive('heading', { level })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: level as 1 | 2 | 3,
                  })
                  .run()
              }
            >
              H{level}
            </ToolbarButton>
          ))}

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <i className="ri-bold" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i className="ri-italic" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Underline"
            active={editor.isActive('underline')}
            onClick={() =>
              editor.chain().focus().toggleUnderline().run()
            }
          >
            <i className="ri-underline" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Strikethrough"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <i className="ri-strikethrough" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Inline code"
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <i className="ri-code-line" aria-hidden="true" />
          </ToolbarButton>

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Bulleted list"
            active={editor.isActive('bulletList')}
            onClick={() =>
              editor.chain().focus().toggleBulletList().run()
            }
          >
            <i className="ri-list-unordered" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
          >
            <i className="ri-list-ordered" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() =>
              editor.chain().focus().toggleBlockquote().run()
            }
          >
            <i className="ri-double-quotes-l" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Code block"
            active={editor.isActive('codeBlock')}
            onClick={() =>
              editor.chain().focus().toggleCodeBlock().run()
            }
          >
            <i className="ri-code-box-line" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Add or edit link"
            active={editor.isActive('link')}
            onClick={insertLink}
          >
            <i className="ri-link" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Insert horizontal divider"
            onClick={() =>
              editor.chain().focus().setHorizontalRule().run()
            }
          >
            <i className="ri-separator" aria-hidden="true" />
          </ToolbarButton>

          <span className="rich-text-editor__separator" />

          <ToolbarButton
            label="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <i className="ri-arrow-go-back-line" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <i className="ri-arrow-go-forward-line" aria-hidden="true" />
          </ToolbarButton>

          <ToolbarButton
            label={
              canAddImage
                ? 'Upload and insert image'
                : 'Save the record before uploading images'
            }
            disabled={uploading || !canAddImage}
            onClick={() => imageInputRef.current?.click()}
          >
            <i className="ri-image-add-line" aria-hidden="true" />
          </ToolbarButton>

          <input
            ref={imageInputRef}
            className="rich-text-editor__file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => void handleImageSelected(event)}
            aria-label="Select an image"
          />
        </div>
      )}

      {/* INLINE FLOATING POPOVER CLAMPED STRICTLY INSIDE EDITOR BOUNDS */}
      {editable && floatingPopover && (
        <div
          ref={floatingRef}
          className={`rich-text-editor__floating${
            floatingPopover.placeBelow ? ' is-below' : ''
          }`}
          style={{
            top: `${floatingPopover.top}px`,
            left: `${clampedLeft ?? floatingPopover.rawCenterX}px`,
            visibility: clampedLeft === null ? 'hidden' : 'visible',
          }}
          role="toolbar"
          aria-label={
            floatingPopover.kind === 'image'
              ? 'Image resize and alignment options'
              : 'Selected text formatting options'
          }
          onMouseDown={(event) => event.preventDefault()}
        >
          {floatingPopover.kind === 'image' ? (
            <>
              <div className="rich-text-editor__floating-group">
                {(
                  [
                    ['small', 'S'],
                    ['medium', 'M'],
                    ['wide', '100%'],
                    ['full', 'Full'],
                  ] as const
                ).map(([preset, text]) => (
                  <ToolbarButton
                    key={preset}
                    label={`Image size: ${text}`}
                    active={activeWidth === preset}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .updateAttributes('image', { width: preset })
                        .run()
                    }
                  >
                    {text}
                  </ToolbarButton>
                ))}
              </div>

              <span className="rich-text-editor__separator" />

              <div className="rich-text-editor__floating-group">
                <ToolbarButton
                  label="Align image left"
                  active={activeAlign === 'left'}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes('image', { align: 'left' })
                      .run()
                  }
                >
                  <i className="ri-align-left" aria-hidden="true" />
                </ToolbarButton>

                <ToolbarButton
                  label="Center image"
                  active={activeAlign === 'center'}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes('image', { align: 'center' })
                      .run()
                  }
                >
                  <i className="ri-align-center" aria-hidden="true" />
                </ToolbarButton>

                <ToolbarButton
                  label="Align image right"
                  active={activeAlign === 'right'}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes('image', { align: 'right' })
                      .run()
                  }
                >
                  <i className="ri-align-right" aria-hidden="true" />
                </ToolbarButton>
              </div>

              <span className="rich-text-editor__separator" />

              <div className="rich-text-editor__floating-group">
                <ToolbarButton
                  label="Move image up"
                  disabled={!canMoveImageUp}
                  onClick={() => moveSelectedImage('up')}
                >
                  <i className="ri-arrow-up-line" aria-hidden="true" />
                </ToolbarButton>

                <ToolbarButton
                  label="Move image down"
                  disabled={!canMoveImageDown}
                  onClick={() => moveSelectedImage('down')}
                >
                  <i className="ri-arrow-down-line" aria-hidden="true" />
                </ToolbarButton>
              </div>
            </>
          ) : (
            <>
              <ToolbarButton
                label="Heading 1"
                active={editor.isActive('heading', { level: 1 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
              >
                H1
              </ToolbarButton>

              <ToolbarButton
                label="Heading 2"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
              >
                H2
              </ToolbarButton>

              <span className="rich-text-editor__separator" />

              <ToolbarButton
                label="Bold"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <i className="ri-bold" aria-hidden="true" />
              </ToolbarButton>

              <ToolbarButton
                label="Italic"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <i className="ri-italic" aria-hidden="true" />
              </ToolbarButton>

              <ToolbarButton
                label="Underline"
                active={editor.isActive('underline')}
                onClick={() =>
                  editor.chain().focus().toggleUnderline().run()
                }
              >
                <i className="ri-underline" aria-hidden="true" />
              </ToolbarButton>

              <ToolbarButton
                label="Inline code"
                active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                <i className="ri-code-line" aria-hidden="true" />
              </ToolbarButton>

              <span className="rich-text-editor__separator" />

              <ToolbarButton
                label="Blockquote"
                active={editor.isActive('blockquote')}
                onClick={() =>
                  editor.chain().focus().toggleBlockquote().run()
                }
              >
                <i className="ri-double-quotes-l" aria-hidden="true" />
              </ToolbarButton>

              <ToolbarButton
                label="Code block"
                active={editor.isActive('codeBlock')}
                onClick={() =>
                  editor.chain().focus().toggleCodeBlock().run()
                }
              >
                <i className="ri-code-box-line" aria-hidden="true" />
              </ToolbarButton>

              <ToolbarButton
                label="Link"
                active={editor.isActive('link')}
                onClick={insertLink}
              >
                <i className="ri-link" aria-hidden="true" />
              </ToolbarButton>
            </>
          )}
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="rich-text-editor__footer">
        <span>
          Select text or click an image for inline formatting &amp; resize options
        </span>
        {uploading && (
          <span role="status">Uploading image…</span>
        )}
      </div>

      {uploadError && (
        <p
          className="rich-text-editor__feedback is-error"
          role="alert"
        >
          {uploadError}
        </p>
      )}

      {uploadMessage && (
        <p className="rich-text-editor__feedback" role="status">
          {uploadMessage}
        </p>
      )}

      {!canUploadImage && allowPendingImages && (
        <p className="rich-text-editor__hint">
          Images will be uploaded after this record is created.
        </p>
      )}

      {!canUploadImage && !allowPendingImages && (
        <p className="rich-text-editor__hint">
          Save the record first, then open Update to upload images.
        </p>
      )}
    </div>
  )
}