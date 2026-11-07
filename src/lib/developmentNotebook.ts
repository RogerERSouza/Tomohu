import type { Notebook } from '../types'

/**
 * An isolated fixture for checking the local API.
 * Never use the active notebook as an anonymous API test payload.
 */
export function createDevelopmentNotebook(): Notebook {
  return {
    schemaVersion: 1,
    sections: [],
    contents: [],
    reminders: [],
  }
}
