import type { Notebook, Reminder, Section } from '../types'

export type Editor =
  | { kind: 'section'; section?: Section }
  | { kind: 'content' }
  | { kind: 'settings' }
  | { kind: 'reminder'; reminder?: Reminder }
  | { kind: 'expired-reminder'; reminder: Reminder }
  | { kind: 'import-backup'; backup: Notebook; fileName: string }
  | null
