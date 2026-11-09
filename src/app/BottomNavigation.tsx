import { Icon } from '../components/Icon'

export function BottomNavigation({
  isHome,
  settingsOpen,
  onHome,
  onSettings,
}: {
  isHome: boolean
  settingsOpen: boolean
  onHome: () => void
  onSettings: () => void
}) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <button
        className={
          isHome && !settingsOpen
            ? 'bottom-nav-button active'
            : 'bottom-nav-button'
        }
        aria-current={isHome && !settingsOpen ? 'page' : undefined}
        onClick={onHome}
      >
        <Icon name="home" />
        <span>Início</span>
      </button>
      <button
        className={
          settingsOpen ? 'bottom-nav-button active' : 'bottom-nav-button'
        }
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={onSettings}
      >
        <Icon name="settings" />
        <span>Ajustes</span>
      </button>
    </nav>
  )
}
