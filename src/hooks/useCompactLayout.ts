import { useEffect, useState } from 'react'
export function useCompactLayout() {
  const [isCompactContentLayout, setIsCompactContentLayout] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateContentLayout = () => setIsCompactContentLayout(media.matches)
    media.addEventListener('change', updateContentLayout)
    return () => media.removeEventListener('change', updateContentLayout)
  }, [])

  return isCompactContentLayout
}
