import type { Content, ContentKind, Notebook, Section } from '../../types'
import type { PrivateSummary, PrivateSnapshot } from '../../lib/api/privacy'

export type SectionValues = Pick<Section, 'title' | 'emoji' | 'color' | 'tags'>
export interface ItemPrivacyControls {
  error?: string
  state: (
    kind: 'section' | 'content',
    id?: string,
  ) => 'public' | 'private' | 'inherited'
  section: (
    existing: Section | undefined,
    parentId: string | null,
    values: SectionValues,
    makePrivate: boolean,
  ) => string | void
  content: (
    existing: Content | undefined,
    parentId: string,
    kind: ContentKind,
    title: string,
    makePrivate: boolean,
  ) => string | void
}
export interface PrivateDocument extends PrivateSnapshot {
  item: PrivateSummary
  identity: string
  dirty: boolean
  configure?: boolean
}
export type PrivateCreation = {
  kind: 'section' | 'content'
  root_id: string
  parent_id: string | null
  revision: number
  snapshot: Notebook
}
