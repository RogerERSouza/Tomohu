import { Icon } from '../components/Icon'
import type { Content, Section } from '../types'

export function Breadcrumb({
  path,
  currentContent,
  currentSection,
  openSection,
}: {
  path: Section[]
  currentContent: Content | undefined
  currentSection: Section | undefined
  openSection: (id?: string) => void
}) {
  return (
    <nav className="breadcrumb" aria-label="Localização">
      <button onClick={() => openSection()}>Início</button>
      {path.map((section) => (
        <span key={section.id}>
          <Icon name="chevron" />
          <button
            onClick={() => openSection(section.id)}
            aria-current={
              !currentContent && currentSection?.id === section.id
                ? 'page'
                : undefined
            }
          >
            {section.title}
          </button>
        </span>
      ))}
      {currentContent && (
        <span>
          <Icon name="chevron" />
          <span aria-current="page">{currentContent.title}</span>
        </span>
      )}
    </nav>
  )
}
