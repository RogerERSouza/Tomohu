export type SortOrder = 'newest' | 'oldest' | 'alphabetical'

export type CollectionFilters = {
  query: string
  sortOrder: SortOrder
  colorFilter: string | null
  tagFilter: string | null
}
