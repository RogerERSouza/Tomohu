import type { Notebook } from '../../types'
import { isNotebook } from '../notebookValidation.ts'
import { AccountDataError, validateAccountData } from './limits.ts'

/** Normalize only the outbound copy; local snapshots and backups stay unchanged. */
export function prepareAccountSnapshot(snapshot: Notebook): Notebook {
  if (!isNotebook(snapshot))
    throw new AccountDataError(
      'O caderno contém dados inválidos. Exporte uma cópia e revise os campos antes de enviar.',
    )
  const prepared: Notebook = {
    ...snapshot,
    contents: snapshot.contents.map((content) =>
      content.kind !== 'counter'
        ? content
        : {
            ...content,
            entries: content.entries.map((entry) => {
              const date = new Date(entry.createdAt)
              if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999)
                throw new AccountDataError(
                  'Um registro do contador tem data fora do intervalo de 0001 a 9999. Exporte a cópia e corrija a data antes de enviar.',
                )
              return { ...entry, createdAt: date.toISOString() }
            }),
          },
    ),
  }
  validateAccountData(prepared)
  return prepared
}
