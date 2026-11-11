import type { Notebook } from '../../types'

export class AccountDataError extends Error {}
function length(value: string) {
  return Array.from(value).length
}
export function validateAccountData(notebook: Notebook): void {
  function checkLimit(condition: boolean, message: string) {
    if (!condition) throw new AccountDataError(message)
  }
  function title(value: string) {
    checkLimit(
      length(value) > 0 && length(value) <= 160,
      'Os títulos precisam ter entre 1 e 160 caracteres para enviar à conta.',
    )
  }
  function id(value: string) {
    checkLimit(
      length(value) <= 36,
      'Há um identificador antigo maior que o limite da conta. Exporte a cópia para revisar os dados antes de enviar.',
    )
  }
  checkLimit(
    notebook.sections.length <= 1000 &&
      notebook.contents.length <= 5000 &&
      notebook.reminders.length <= 5000,
    'Este caderno excede os limites da conta: 1.000 seções, 5.000 conteúdos ou 5.000 lembretes. Divida-o antes de enviar.',
  )
  for (const section of notebook.sections) {
    id(section.id)
    if (section.parentId) id(section.parentId)
    title(section.title)
    checkLimit(
      /^#[0-9a-f]{6}$/i.test(section.color),
      'Uma seção tem cor incompatível. Edite a cor antes de enviar à conta.',
    )
    checkLimit(
      length(section.emoji) <= 16,
      'Um emoji de seção excede 16 caracteres.',
    )
    checkLimit(
      (section.tags?.length ?? 0) <= 20,
      'Uma seção excede o limite de 20 tags da conta.',
    )
  }
  for (const content of notebook.contents) {
    id(content.id)
    id(content.sectionId)
    title(content.title)
    if (content.kind === 'note' || content.kind === 'tutorial')
      checkLimit(
        length(content.text) <= 20000,
        'Uma nota ou tutorial excede 20.000 caracteres. Divida o texto antes de enviar à conta.',
      )
    if (content.kind === 'checklist' || content.kind === 'tutorial') {
      checkLimit(
        content.items.length <= 500,
        'Uma lista excede o limite de 500 itens da conta.',
      )
      for (const item of content.items) {
        id(item.id)
        checkLimit(
          length(item.text) <= 500,
          'Um item de lista excede 500 caracteres.',
        )
      }
    }
    if (content.kind === 'counter') {
      checkLimit(
        content.entries.length <= 5000,
        'Um contador excede 5.000 registros da conta.',
      )
      for (const entry of content.entries) {
        id(entry.id)
        checkLimit(
          length(entry.note) <= 500 && length(entry.createdAt) <= 40,
          'Um registro do contador excede os limites de texto ou data da conta.',
        )
      }
    }
  }
  for (const reminder of notebook.reminders) {
    id(reminder.id)
    title(reminder.title)
    checkLimit(
      (reminder.repeatTimes?.length ?? 0) <= 24,
      'Um lembrete excede o limite de 24 horários programados da conta.',
    )
  }
}
