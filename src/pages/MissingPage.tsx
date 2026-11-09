export function MissingPage({ onHome }: { onHome: () => void }) {
  return (
    <section className="empty-state">
      <h1>Conteúdo não encontrado</h1>
      <p>Este endereço não está neste caderno.</p>
      <button className="primary-button" onClick={onHome}>
        Voltar ao início
      </button>
    </section>
  )
}
