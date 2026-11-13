import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import type { PrivacyController } from './usePrivacy'
export interface PrivateCell {
  id: string
  kind: 'section' | 'content'
  position: number
  node: ReactNode
}
export function privateCells(
  privacy: PrivacyController,
  parentId: string | null,
): PrivateCell[] {
  if (privacy.mode !== 'inline') return []
  return privacy.items
    .filter((item) => item.parent_id === parentId)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      position: item.position,
      node: (
        <article
          className={`locked-item ${item.kind === 'section' ? 'section-card' : 'content-card'}`}
          key={item.id}
        >
          <button
            className="locked-open"
            onClick={() => privacy.open(item.id)}
            disabled={privacy.busy}
          >
            <span className="private-preview" aria-hidden="true">
              ▰ ▰ ▰<br />▰ ▰ ▰
            </span>
            <span className="private-lock" aria-hidden="true">
              🔒
            </span>
            <span>
              {item.kind === 'section' ? 'Seção privada' : 'Conteúdo privado'}
            </span>
          </button>
          <button
            className="icon-button section-menu"
            aria-label={`Configurar ${item.kind === 'section' ? 'seção privada' : 'conteúdo privado'}`}
            onClick={() => privacy.open(item.id, true)}
            disabled={privacy.busy}
          >
            <Icon name="more" />
          </button>
        </article>
      ),
    }))
}
export function insertPrivateSlots<T>(
  publicItems: T[],
  privateItems: { position: number; value: T }[],
): T[] {
  const result = [...publicItems]
  for (const entry of [...privateItems].sort((a, b) => a.position - b.position))
    result.splice(
      Math.min(result.length, Math.max(0, entry.position)),
      0,
      entry.value,
    )
  return result
}
