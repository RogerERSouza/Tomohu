export function ExpiredReminderPanel({
  onRemove,
  onReschedule,
}: {
  onRemove: () => void
  onReschedule: () => void
}) {
  return (
    <div className="expired-reminder-panel">
      <p>O prazo deste evento terminou. Deseja excluir ou alterar a data?</p>
      <div className="expired-reminder-actions">
        <button type="button" className="text-button danger" onClick={onRemove}>
          Excluir lembrete
        </button>
        <button type="button" className="primary-button" onClick={onReschedule}>
          Alterar data
        </button>
      </div>
    </div>
  )
}
