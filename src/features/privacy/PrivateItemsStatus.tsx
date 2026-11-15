import type { PrivacyController } from './usePrivacy'

export function PrivateItemsStatus({
  privacy,
}: {
  privacy: PrivacyController
}) {
  if (!privacy.itemsError) return null
  return (
    <div className="workspace-status" role="alert">
      <p>{privacy.itemsError}</p>
      <button
        className="text-button"
        disabled={privacy.itemsLoading || privacy.busy}
        onClick={privacy.retryItems}
      >
        {privacy.itemsLoading
          ? 'Atualizando itens privados…'
          : 'Tentar carregar itens privados novamente'}
      </button>
    </div>
  )
}
