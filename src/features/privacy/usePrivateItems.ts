import { useCallback, useEffect, useRef, useState } from 'react'
import { createApiClient } from '../../lib/api/client'
import type { PrivateSummary } from '../../lib/api/privacy'

const failure =
  'Não foi possível atualizar os itens privados. Eles não foram apagados. Tente novamente.'
export function usePrivateItems(
  origin: string,
  token: string,
  notebookId: string,
) {
  const context = `${token}:${notebookId}`
  const [state, setState] = useState<{
    context: string
    items: PrivateSummary[]
    loading: boolean
    error: string
  }>({ context: '', items: [], loading: false, error: '' })
  const generation = useRef({ value: 0 })
  const refresh = useCallback(
    async (grant = '') => {
      if (!token || !notebookId) return []
      const request = ++generation.current.value
      setState((previous) => ({
        context,
        items: previous.context === context ? previous.items : [],
        loading: true,
        error: previous.context === context ? previous.error : '',
      }))
      try {
        const items = await createApiClient(origin, token).privateItems(
          notebookId,
          grant,
        )
        if (request === generation.current.value)
          setState({ context, items, loading: false, error: '' })
        return items
      } catch (error) {
        if (request === generation.current.value)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: failure,
          }))
        throw error
      }
    },
    [origin, token, notebookId, context],
  )
  useEffect(() => {
    const sequence = generation.current
    let active = true
    queueMicrotask(() => {
      if (active) void refresh().catch(() => undefined)
    })
    return () => {
      active = false
      sequence.value++
    }
  }, [refresh])
  return {
    items: state.context === context ? state.items : [],
    error: state.context === context ? state.error : '',
    loading: state.context === context && state.loading,
    refresh,
    forget(id: string) {
      setState((previous) =>
        previous.context === context
          ? {
              ...previous,
              items: previous.items.filter((item) => item.id !== id),
            }
          : previous,
      )
    },
  }
}
