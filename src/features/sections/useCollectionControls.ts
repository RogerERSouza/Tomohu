import { useEffect, useRef, useState } from 'react'
import type { SortOrder } from './collectionTypes'
export function useCollectionControls() {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isSortMenuOpen) return
    const closeMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !sortMenuRef.current?.contains(event.target)
      )
        setIsSortMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [isSortMenuOpen])

  function reset() {
    setQuery('')
    setColorFilter(null)
    setTagFilter(null)
    setIsSortMenuOpen(false)
  }
  return {
    query,
    setQuery,
    sortOrder,
    setSortOrder,
    colorFilter,
    setColorFilter,
    tagFilter,
    setTagFilter,
    isSortMenuOpen,
    setIsSortMenuOpen,
    sortMenuRef,
    reset,
  }
}
export type CollectionControls = ReturnType<typeof useCollectionControls>
