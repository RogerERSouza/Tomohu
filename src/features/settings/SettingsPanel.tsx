import { Icon } from '../../components/Icon'
import { version as appVersion } from '../../../package.json'
import type { HourFormat } from '../../lib/time'
import type { Theme } from './usePreferences'

export function SettingsPanel({
  theme,
  setTheme,
  hourFormat,
  setHourFormat,
  onExport,
  onImport,
  importError,
}: {
  theme: Theme
  setTheme: (theme: Theme) => void
  hourFormat: HourFormat
  setHourFormat: (format: HourFormat) => void
  onExport: () => void
  onImport: () => void
  importError: string
}) {
  return (
    <div className="settings-panel">
      <fieldset className="theme-field">
        <legend>Tema</legend>
        <div
          className="theme-options"
          role="radiogroup"
          aria-label="Tema do app"
        >
          <button
            type="button"
            className={
              theme === 'dark' ? 'theme-option selected' : 'theme-option'
            }
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            Escuro
          </button>
          <button
            type="button"
            className={
              theme === 'light' ? 'theme-option selected' : 'theme-option'
            }
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            Claro
          </button>
        </div>
      </fieldset>
      <fieldset className="theme-field">
        <legend>Formato de hora</legend>
        <div
          className="theme-options"
          role="radiogroup"
          aria-label="Formato de hora"
        >
          <button
            type="button"
            className={
              hourFormat === '24h' ? 'theme-option selected' : 'theme-option'
            }
            aria-pressed={hourFormat === '24h'}
            onClick={() => setHourFormat('24h')}
          >
            24 horas
          </button>
          <button
            type="button"
            className={
              hourFormat === '12h' ? 'theme-option selected' : 'theme-option'
            }
            aria-pressed={hourFormat === '12h'}
            onClick={() => setHourFormat('12h')}
          >
            12 horas (AM/PM)
          </button>
        </div>
      </fieldset>
      <button className="secondary-button" onClick={onExport}>
        <Icon name="download" />
        Exportar cópia dos dados
      </button>
      <button className="secondary-button" onClick={onImport}>
        Importar cópia dos dados
      </button>
      {importError && (
        <p className="form-warning" role="alert">
          {importError}
        </p>
      )}
      <p className="muted">Os dados ficam neste navegador.</p>
      <span className="muted">Tomohu · v{appVersion}</span>
    </div>
  )
}
