import type { Content, Notebook, Section } from '../../types'
import { searchNotebook } from '../../lib/search.ts'
import type { CollectionFilters } from './collectionTypes'

function getContentColumns(contents: Content[], isCompactLayout: boolean) {
  if (isCompactLayout) return [contents]
  return [
    contents.filter((_, index) => index % 2 === 0),
    contents.filter((_, index) => index % 2 === 1),
  ]
}

export function selectCollection(
  notebook: Notebook,
  currentSection: Section | undefined,
  isHome: boolean,
  controls: CollectionFilters,
  isCompactContentLayout: boolean,
) {
  const { query, sortOrder, colorFilter, tagFilter } = controls
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const isGlobalSearchActive = isHome && Boolean(normalizedQuery)
  const parentId = currentSection?.id ?? null
  const sectionsInScope = notebook.sections.filter(
    (section) =>
      (isHome && normalizedQuery ? true : section.parentId === parentId) &&
      section.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  )
  const usedColors = [
    ...new Set(sectionsInScope.map((section) => section.color)),
  ]
  const usedTags = [
    ...new Set(sectionsInScope.flatMap((section) => section.tags ?? [])),
  ].sort((first, second) => first.localeCompare(second, 'pt-BR'))
  const visibleSections = notebook.sections.filter(
    (section) =>
      (isHome && normalizedQuery ? true : section.parentId === parentId) &&
      section.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery) &&
      (!colorFilter || section.color === colorFilter) &&
      (!tagFilter || section.tags?.includes(tagFilter)),
  )
  if (sortOrder === 'newest') visibleSections.reverse()
  if (sortOrder === 'alphabetical')
    visibleSections.sort((first, second) =>
      first.title.localeCompare(second.title, 'pt-BR'),
    )
  visibleSections.sort(
    (first, second) =>
      Number(Boolean(second.favorite)) - Number(Boolean(first.favorite)),
  )
  const visibleContents = notebook.contents.filter(
    (content) =>
      content.sectionId === currentSection?.id &&
      !colorFilter &&
      content.title.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  )
  const contentColumns = getContentColumns(
    visibleContents,
    isCompactContentLayout,
  )
  const globalSearchResults = isGlobalSearchActive
    ? searchNotebook(notebook, query)
    : []

  return {
    normalizedQuery,
    isGlobalSearchActive,
    usedColors,
    usedTags,
    visibleSections,
    visibleContents,
    contentColumns,
    globalSearchResults,
  }
}
export type Collection = ReturnType<typeof selectCollection>
