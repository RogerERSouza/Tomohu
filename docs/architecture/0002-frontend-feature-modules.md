# ADR 0002: Frontend feature modules

- Status: Accepted for 0.19.0
- Date: 2026-11-09
- Baseline: main at `161960c`

## Context

The previous App.tsx combined forms, routes, preferences, collection selection, notebook mutations, backups, and page markup in 1,614 lines. Changes to one feature required inspecting unrelated state and effects. The frontend already had valuable domain functions and a stable local notebook format. Version 0.19 must preserve behavior before authenticated integration is designed separately.

## Decision

Use feature modules and React composition within the existing monorepo. Keep the frontend at the repository root so build paths and GitHub Pages remain stable.

| Location                              | Responsibility                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/app`                             | App composition, hash navigation, breadcrumbs, bottom navigation, typed dialog selection |
| `src/pages`                           | Notebook, content, and missing-route views; collection composition                       |
| `src/features/sections`               | Section form/card, collection controls and pure selection                                |
| `src/features/contents`               | Content creation, cards, editors and list progress                                       |
| `src/features/reminders`              | Reminder form, priority strip and expired-event decision                                 |
| `src/features/settings`               | Persisted preferences and settings UI                                                    |
| `src/features/search`                 | Global search result presentation                                                        |
| `src/features/backup`                 | JSON file reading, downloads and replacement confirmation                                |
| `src/features/notebook`               | One notebook state owner, functional state mutations and browser storage adapter         |
| `src/components`, `src/hooks`         | Shared UI primitives and browser hooks                                                   |
| `src/lib`, `src/types.ts`, `src/data` | React-independent rules, data contracts and initial content                              |

App mounts `useNotebook` once. Pages and dialogs receive data and typed callbacks. `createNotebookActions` uses functional state updates, preserving batched edits. Derived collections are computed from current state rather than stored in a second mutable copy. `notebookStorage` handles persistence; `useNotebook` handles the React lifecycle and existing save-error policy.

Dependency direction is app → pages/features → shared UI/domain. Features cannot import app/pages; shared modules cannot import features. Domain modules cannot import React or UI. ESLint rejects these dependencies. Features currently coordinate through app/pages and the notebook aggregate, without a global context or state library.

TypeScript strict mode applies to the app and tests. Discriminated content and dialog unions are preserved. Shared CSS remains in App.css/index.css because its selectors depend on existing DOM relationships; extraction preserves that DOM and all class names. Splitting CSS is a separate decision requiring the same visual checks.

## Alternatives and trade-offs

- A single components directory is simple but obscures feature ownership as the project grows.
- Copying the Mentorly controller/service layers into React would add indirection without matching React's state and composition model. Only the principle of separated responsibilities is shared.
- Router and global-state dependencies are unnecessary for the current hash routes and single aggregate. Consider them when actual routing or state requirements justify them.
- Separate files introduce imports and explicit callback props. This is preferable to hidden shared state at the current size; avoid replacing App.tsx with one large controller hook.
- The new dependencies are development tools only: Playwright for real-browser flows, Testing Library/user-event/JSDOM for component interactions, tsx for the TSX test runtime, and JSDOM types. Runtime product dependencies remain React and React DOM.

## Data and security

Storage key `task.notebook.v1`, schema version 1, `tomohu.theme`, `tomohu.hour-format`, and hash routes remain unchanged. No migration, account token, network synchronization or ownership decision is introduced. Invalid existing storage remains preserved with autosave paused; failed writes retain an export action. Destructive imports and deletions retain their confirmations. Browser storage is still local and unencrypted; backend authorization remains the separate 0.18 implementation.

## Validation and recovery

Establish component and browser coverage on the baseline before extraction. Reuse the scenarios after extraction, including reloads, invalid storage, blocked writes, backups, scheduling and desktop/mobile layout. See the release record for executed results and limitations. CI runs strict type checks and browser tests in addition to the existing checks.

Export a JSON backup before deployment validation. The format is unchanged, so returning to the previous release does not require a data downgrade. Revert the release commit through a reviewed PR; avoid resetting a shared main branch or clearing browser storage. Future account integration belongs to 0.20 and needs a separate migration/conflict policy.
