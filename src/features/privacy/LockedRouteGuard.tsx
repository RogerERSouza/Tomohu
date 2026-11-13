import { useEffect, useSyncExternalStore } from 'react'
import type { Notebook } from '../../types'
import type { PrivacyController } from './usePrivacy'
const subscribe = (changed: () => void) => {
  window.addEventListener('hashchange', changed)
  return () => window.removeEventListener('hashchange', changed)
}
const currentHash = () => window.location.hash
export function LockedRouteGuard({
  notebook,
  privacy,
}: {
  notebook: Notebook
  privacy: PrivacyController
}) {
  const hash = useSyncExternalStore(subscribe, currentHash)
  useEffect(() => {
    if (privacy.prompt || privacy.busy) return
    const [kind, id] = hash.replace(/^#/, '').split('/')
    const exists =
      kind === 'section'
        ? notebook.sections.some((s) => s.id === id)
        : kind === 'content'
          ? notebook.contents.some((c) => c.id === id)
          : true
    if (exists) return
    const item = privacy.items.find(
      (item) => item.kind === kind && item.root_id === id,
    )
    if (item) privacy.open(item.id, false, '')
  }, [hash, notebook, privacy])
  return null
}
