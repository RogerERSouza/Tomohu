# Feature: Mandatory accounts and session continuity

Status: Draft

Baseline: `e8efb610b647c0e4caba126315d845fa62b7db5f` (0.22.1). Accounts are optional. Guest notebooks and pending account caches are separate; bearer tokens are memory-only. Account notebooks synchronize explicitly, while opened private items autosave remotely.

Delivery: Unassigned. Specification only; application behavior is unchanged.

## Outcome and scope

Require account authentication before normal notebook use, while preserving existing local and account data. Returning users should have a clear, secure way to resume their account.

In scope: registration/login entry screen, recovery entry points, authenticated access, session lifecycle, existing guest data transition and sign-out/expiry behavior.

Out of scope: automatic public synchronization, settings-page reorganization, drag-and-drop ordering, social login, end-to-end encryption and production deployment. These remain separate deliveries.

## Requirements and invariants

- **R1 — Requested:** unauthenticated users see login, registration and password-recovery actions before normal notebook access. Existing users can sign in without registering again.
- **R2 — Requested:** successful authentication opens the account experience, with a clear first-notebook flow for new accounts.
- **R3 — Existing invariant:** preserve `task.notebook.v1`, pending account caches, backups and private drafts. Authentication or logout must not silently delete or upload them. Legacy data recovery must remain accessible even if authentication is unavailable, without reopening normal guest editing.
- **R4 — Existing invariant:** derive ownership on the server. A UI login gate does not replace API authorization. A revoked/expired session cannot continue protected requests.
- **R5 — Proposed:** resume authenticated sessions on reopening where securely supported. Define refresh, rotation, revocation, CSRF/CORS and failure behavior in an ADR before implementation; do not persist the current bearer token in localStorage as a shortcut.
- **R6 — Existing invariant:** retain explicit public synchronization and separate private autosave behavior. Explain unsent work and preserve it across expiry, network errors and reauthentication. A pending private draft must not move into another account.
- **R7 — Proposed:** when API configuration or connectivity is unavailable, show actionable status and retry/recovery paths; never show a broken form or silently enable a guest editing bypass.
- **R8 — Existing invariant:** preserve keyboard access, focus and usable mobile layouts. Email-link verification and account/privacy recovery must remain reachable from logged-out entry routes.

## Acceptance scenarios

| ID  | Given / When                                                                        | Expected observable result                                                                                                                             | Verification                                                 |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| AC1 | Fresh browser, no session; open home or a direct notebook hash                      | Authentication entry is shown; notebook editing is unavailable; login/register/recovery actions work                                                   | Desktop/mobile browser tests                                 |
| AC2 | Valid registration or existing-account login completes                              | User reaches their own account and can select/create a notebook; no guest data is uploaded implicitly                                                  | Real API browser tests                                       |
| AC3 | A legacy guest notebook exists; authentication fails or succeeds                    | Original guest data remains byte-for-byte intact until an explicit, validated transition; recovery/export remains possible when sign-in is unavailable | Storage + browser tests; exact transition UI awaits decision |
| AC4 | An authenticated user reopens the app                                               | Apply the documented session-continuity policy; invalid/revoked credentials cannot unlock account data                                                 | Real API tests after session ADR                             |
| AC5 | Session expires/revokes while edits are pending                                     | Preserve public caches and private drafts; require authentication for protected work; prevent cross-account draft replacement                          | Component + real API/browser tests                           |
| AC6 | API is missing/offline or credentials are invalid                                   | Actionable error and appropriate retry/recovery; no silent data deletion or normal guest-editing bypass                                                | Browser failure scenarios                                    |
| AC7 | Password reset, email verification or privacy reset link is opened while logged out | Explicit confirmation and correct link-purpose handling work without exposing notebook editing                                                         | Existing and extended lifecycle tests                        |
| AC8 | User signs out or changes account                                                   | Protected UI closes; account ownership remains isolated; pending-data recovery rules are honored                                                       | Component + browser/API tests                                |

## Decisions and open questions

Agreed: account-first access, preserved existing data, independent privacy credentials and separate deliveries for settings/custom ordering.

Material decisions to resolve before implementation:

1. Session persistence architecture and hosting assumptions: refresh-cookie flow or an explicitly justified alternative; trusted origins, cookie attributes, CSRF protection, expiry, rotation, concurrent requests and revocation. Existing GitHub Pages frontend and separately hosted API must be considered.
2. Existing guest-data transition: when/how the user chooses a copy into the account, how completion is verified, and how export remains accessible before login. Never assume local deletion is authorized.
3. Offline behavior: define whether previously authenticated users can inspect cached public data while offline, how that differs from a valid online session, and which operations stay unavailable. Private access remains protected; no offline private persistence is introduced implicitly.
4. First-use flow: whether a new account receives an empty notebook automatically or chooses one explicitly. Define verification requirements without accidentally changing existing-account access policy.

Routine implementation details can be resolved from the repository and these constraints; only material product decisions need user clarification.

## Implementation plan

Inspect `src/app/App.tsx`, account/sync/privacy controllers, storage adapters, account-link handling and the auth/session backend before designing changes. Document session security in a new ADR. Specify API/session contracts, additive migration needs, compatibility and recovery before writing them. Add an authentication boundary without hiding recovery routes or silently resetting existing state.

No runtime change or database migration is part of this process-adoption patch. Migration and rollback details for the future feature are not yet decided.

## Tasks

- [ ] Resolve session architecture, legacy-data transition, offline and first-use decisions.
- [ ] Record the ADR, contracts and safe migration/recovery plan.
- [ ] Map acceptance criteria to meaningful tests; reproduce critical failure cases before implementation.
- [ ] Implement authentication entry and session lifecycle in scoped steps.
- [ ] Validate desktop/mobile, real API/PostgreSQL, old data and recovery paths.
- [ ] Record evidence, review the complete diff and update delivery documentation.

## Validation evidence

| Criterion/check | Test or procedure | Result  | Evidence/limitations                                                          |
| --------------- | ----------------- | ------- | ----------------------------------------------------------------------------- |
| AC1–AC8         | Planned above     | Not run | Feature is not implemented; 0.22.1 tests do not establish these new behaviors |

## Delivery and remaining limitations

This is a draft for specification-driven development, not an implemented release. Current optional-login behavior remains unchanged. Resolve the material decisions before marking this specification Ready.
