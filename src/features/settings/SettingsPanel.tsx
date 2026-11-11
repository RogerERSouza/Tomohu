import type { ReactNode } from 'react'
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
  accountPanel,
  importBlocked = false,
}: {
  theme: Theme
  setTheme: (theme: Theme) => void
  hourFormat: HourFormat
  setHourFormat: (format: HourFormat) => void
  onExport: () => void
  onImport: () => void
  importError: string
  importBlocked?: boolean
  accountPanel?: ReactNode
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
      <button
        className="secondary-button"
        onClick={onImport}
        disabled={importBlocked}
      >
        Importar cópia dos dados
      </button>
      {importBlocked && (
        <p role="status">
          Aguarde a operação da conta terminar antes de importar.
        </p>
      )}
      {importError && (
        <p className="form-warning" role="alert">
          {importError}
        </p>
      )}
      {accountPanel}
      <p className="muted">
        Exporte cópias de segurança. O envio para a conta exige sincronização
        explícita.
      </p>
      <span className="muted">Tomohu · v{appVersion}</span>
    </div>
  )
}
