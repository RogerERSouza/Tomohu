import type { Notebook } from '../../types'
import type { PrivateSummary } from '../../lib/api/privacy'

export function privateView(
  publicBook: Notebook,
  snapshot: Notebook,
  item: PrivateSummary,
): Notebook {
  const sections = snapshot.sections.map((s) =>
    s.id === item.root_id && item.kind === 'section'
      ? {
          ...s,
          parentId: publicBook.sections.some((p) => p.id === item.parent_id)
            ? item.parent_id
            : null,
        }
      : s,
  )
  if (item.kind === 'content') {
    const parent = publicBook.sections.find((s) => s.id === item.parent_id)
    if (parent) sections[0] = parent
  }
  const ids = new Set(sections.map((s) => s.id))
  let parent = sections.find(
    (s) => s.id === (item.kind === 'section' ? item.root_id : item.parent_id),
  )?.parentId
  while (parent && !ids.has(parent)) {
    const section = publicBook.sections.find((s) => s.id === parent)
    if (!section) break
    sections.unshift(section)
    ids.add(section.id)
    parent = section.parentId
  }
  return { ...snapshot, sections }
}
export function privateEdit(
  snapshot: Notebook,
  view: Notebook,
  item: PrivateSummary,
): Notebook {
  if (item.kind === 'content')
    return {
      ...snapshot,
      contents: view.contents.filter((c) => c.id === item.root_id),
    }
  const ids = new Set([item.root_id])
  let previous = -1
  while (previous !== ids.size) {
    previous = ids.size
    for (const section of view.sections)
      if (section.parentId && ids.has(section.parentId)) ids.add(section.id)
  }
  return {
    ...view,
    sections: view.sections
      .filter((s) => ids.has(s.id))
      .map((s) => (s.id === item.root_id ? { ...s, parentId: null } : s)),
    contents: view.contents.filter((c) => ids.has(c.sectionId)),
  }
}
export function ownsPrivateRoute(
  hash: string,
  snapshot: Notebook,
  item: PrivateSummary,
): boolean {
  const [kind, id] = hash.replace(/^#/, '').split('/')
  if (kind === 'content') return snapshot.contents.some((c) => c.id === id)
  return (
    kind === 'section' &&
    item.kind === 'section' &&
    snapshot.sections.some((s) => s.id === id)
  )
}
