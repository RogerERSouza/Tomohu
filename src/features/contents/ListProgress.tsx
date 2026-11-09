import type { ListItem } from '../../types'

export function ListProgress({ items }: { items: ListItem[] }) {
  const completed = items.filter((item) => item.completed).length
  const percentage = items.length
    ? Math.round((completed / items.length) * 100)
    : 0
  return (
    <div className="list-progress">
      <div className="list-progress-label">
        <span>
          {completed} de {items.length} concluídos
        </span>
        <strong>{percentage}%</strong>
      </div>
      <div
        className="list-progress-track"
        role="progressbar"
        aria-label="Progresso da lista"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={completed}
        aria-valuetext={`${completed} de ${items.length} concluídos, ${percentage}%`}
      >
        <span
          className="list-progress-value"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
