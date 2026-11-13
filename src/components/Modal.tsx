import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({
  title,
  onClose,
  children,
  closeOnBackdrop = true,
  closeDisabled = false,
  compact = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  closeOnBackdrop?: boolean
  closeDisabled?: boolean
  compact?: boolean
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      className={compact ? 'modal modal-compact' : 'modal'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeDisabled) onClose()
      }}
      onClick={(event) => {
        if (
          closeDisabled ||
          !closeOnBackdrop ||
          event.target !== event.currentTarget
        )
          return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose()
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
