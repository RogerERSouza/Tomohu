# Feature: Mandatory accounts and session continuity

Status: Draft — product behavior agreed; session design and contracts pending

Baseline: `e8efb610b647c0e4caba126315d845fa62b7db5f` (0.22.1). Accounts are optional. Guest notebooks and pending account caches are separate; bearer tokens are memory-only. Account notebooks synchronize explicitly, while opened private items autosave remotely.

Delivery: Planned 0.23.0. Specification only; application behavior is unchanged.

Planning baseline: `894823cb22fc1adf992641b8472370c9b98422b2` (workflow adoption merged; runtime remains 0.22.1).

## Outcome and scope

Require account authentication before normal notebook use, while preserving existing local and account data. Returning users should have a clear, secure way to resume their account.

In scope: registration/login entry screen, recovery entry points, authenticated access, session lifecycle, existing guest data transition and sign-out/expiry behavior.

Out of scope: automatic public synchronization, settings-page reorganization, drag-and-drop ordering, social login, end-to-end encryption and production deployment. These remain separate deliveries.

## Requirements and invariants

- **R1 — Requested:** unauthenticated users see login, registration and password-recovery actions before normal notebook access. Existing users can sign in without registering again.
- **R2 — Requested:** successful authentication opens the account experience, with an automatically created empty first notebook for new accounts. Repeated registration/bootstrap requests must not create duplicate initial notebooks.
- **R3 — Existing invariant:** preserve `task.notebook.v1`, pending account caches, backups and private drafts. Authentication or logout must not silently delete or upload them. Legacy data recovery must remain accessible even if authentication is unavailable, without reopening normal guest editing.
- **R4 — Existing invariant:** derive ownership on the server. A UI login gate does not replace API authorization. A revoked/expired session cannot continue protected requests.
- **R5 — Agreed:** resume authenticated sessions on reopening through a renewable, revocable session. Define refresh, rotation, revocation, CSRF/CORS and failure behavior in an ADR before implementation; do not persist the current bearer token in localStorage as a shortcut.
- **R6 — Existing invariant:** retain explicit public synchronization and separate private autosave behavior. Explain unsent work and preserve it across expiry, network errors and reauthentication. A pending private draft must not move into another account.
- **R7 — Agreed:** when API configuration or connectivity is unavailable, show actionable status and retry/recovery paths; never show a broken form or silently enable a guest editing bypass.
- **R8 — Existing invariant:** preserve keyboard access, focus and usable mobile layouts. Email-link verification and account/privacy recovery must remain reachable from logged-out entry routes.

- **R9 — Agreed:** after successful authentication, offer an explicit copy of existing guest data into the account. Preserve the original; offer independent export without requiring sign-in. Import failure must leave both the source and any existing destination unchanged.
- **R10 — Agreed:** allow read-only consultation of an already loaded common notebook during a network outage. Disable editing, synchronization and other server mutations. Private items require connectivity. Offline consultation is not proof of a valid server session, and must not be offered after explicit logout or a confirmed authentication rejection.

## Acceptance scenarios

| ID   | Given / When                                                                        | Expected observable result                                                                                                                                                                         | Verification                                                             |
| ---- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| AC1  | Fresh browser, no session; open home or a direct notebook hash                      | Authentication entry is shown; notebook editing is unavailable; login/register/recovery actions work                                                                                               | Desktop/mobile browser tests                                             |
| AC2  | Valid registration or existing-account login completes                              | New account receives one empty first notebook automatically; existing accounts retain their notebooks; repeated requests do not duplicate the first notebook; no guest data is uploaded implicitly | Real API browser tests                                                   |
| AC3  | A legacy guest notebook exists; authentication fails or succeeds                    | Original guest data remains byte-for-byte intact until an explicit, validated transition; recovery/export remains possible when sign-in is unavailable                                             | Storage + browser tests for export and explicit account copy             |
| AC4  | An authenticated user reopens the app                                               | Resume through the renewable session when valid; expired/revoked renewal credentials return to sign-in and cannot unlock server data                                                               | Real API tests after session ADR                                         |
| AC5  | Session expires/revokes while edits are pending                                     | Preserve public caches and private drafts; require authentication for protected work; prevent cross-account draft replacement                                                                      | Component + real API/browser tests                                       |
| AC6  | API is missing/offline or credentials are invalid                                   | Actionable error and appropriate retry/recovery; no silent data deletion or normal guest-editing bypass                                                                                            | Browser failure scenarios; no-API and network outage are distinct states |
| AC7  | Password reset, email verification or privacy reset link is opened while logged out | Explicit confirmation and correct link-purpose handling work without exposing notebook editing                                                                                                     | Existing and extended lifecycle tests                                    |
| AC8  | User signs out or changes account                                                   | Protected UI closes; account ownership remains isolated; pending-data recovery rules are honored                                                                                                   | Component + browser/API tests                                            |
| AC9  | A common notebook is loaded; connectivity is lost                                   | Public notebook is read-only, with a visible offline explanation; edits/server operations/private access are unavailable; reconnect revalidates the session before writes resume                   | Desktop/mobile network-failure tests                                     |
| AC10 | Explicit logout or authentication rejection occurs                                  | Read-only offline fallback is not used to bypass sign-out; data remains preserved for authorized recovery                                                                                          | Component + real API tests                                               |

## Decisions and open questions

Agreed product behavior:

1. Show login/registration/recovery before normal notebook access without a valid session.
2. Resume access on reopening through a renewable, revocable session.
3. Automatically create an empty first notebook for a new account.
4. Offer an explicit account copy of existing guest data while retaining the original.
5. Allow only read-only consultation of the common notebook already loaded during an outage; private access requires connectivity.

Settings navigation and custom ordering remain separate deliveries. Existing email-verification requirements remain unchanged; privacy still requires a verified address.

Technical design work to complete before dependent implementation:

- Record the session ADR: trusted browser origins, renewable credential storage, expiry, rotation, concurrent renewal requests, revocation and CSRF/CORS defenses. Do not assume a GitHub Pages frontend can reliably use cookies from an unrelated API domain.
- Define exact bootstrap/migration contracts and the read-only state boundary, including sign-out versus network failure. No normal guest-editing bypass is allowed.

These technical decisions can be resolved through repository inspection and security design without asking again about the agreed product behavior.

## Implementation plan

The baseline inspection identifies these responsibilities:

| Area                    | Existing modules                                                                                     | Planned work                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication boundary | `src/app/App.tsx`, `src/features/account/`                                                           | Explicit startup/loading, signed-out, authenticated and offline-read-only states; keep account-link routes reachable                                                  |
| Session lifecycle       | `backend/app/api/routes/auth.py`, account models/repository/service, `src/lib/api/`, `useAccount.ts` | Add renewal without storing bearer/renewal secrets in localStorage; retain session revocation semantics and distinguish authentication rejection from network failure |
| Initial notebook        | Auth/bootstrap service and notebook service/repository                                               | Create the first empty notebook transactionally and idempotently; serialize concurrent bootstrap for the same owner; preserve existing notebooks                      |
| Legacy data             | Notebook storage adapter, backup helpers and account-copy flow                                       | Offer export before login and explicit copy after login; retain source bytes and use existing validation; no silent replacement/deletion                              |
| Read-only access        | Notebook shell/editor/action composition and sync/privacy controllers                                | Gate every mutation path, not just visible buttons; hide/lock private views during loss of connectivity; require online session validation before re-enabling writes  |
| Persistence             | Alembic migrations and session records                                                               | Use additive migration for renewal state; define rollback behavior and back up before development-database migration                                                  |
| Verification            | Backend lifecycle/ownership tests, component storage tests and Playwright                            | Cover acceptance IDs with real PostgreSQL/API plus desktop/mobile UI and network-failure scenarios                                                                    |

Implementation sequence:

1. Specify session contracts and record the ADR, including supported hosting and migration/recovery details.
2. Establish failing tests for renewal/revocation, duplicate first-notebook prevention and preservation of old data.
3. Implement backend session renewal and bootstrap before the authentication boundary consumes them.
4. Implement startup/login, guarded account recovery/copy and read-only behavior in separate small changes.
5. Run the existing suite plus acceptance coverage, inspect changed screens and review the entire diff against the spec.

This documentation patch does not implement these steps or apply a database migration. Keep the specification in Draft until the session ADR and contracts are concrete; product behavior is already agreed.

## Tasks

- [x] Define account-first access, session continuity, legacy-data copy, read-only outage behavior and automatic first notebook.
- [x] Identify affected modules and implementation sequence.
- [ ] Finalize session architecture and contracts.
- [ ] Record the ADR, contracts and safe migration/recovery plan.
- [ ] Map acceptance criteria to meaningful tests; reproduce critical failure cases before implementation.
- [ ] Implement authentication entry and session lifecycle in scoped steps.
- [ ] Validate desktop/mobile, real API/PostgreSQL, old data and recovery paths.
- [ ] Record evidence, review the complete diff and update delivery documentation.

## Validation evidence

| Criterion/check | Test or procedure | Result  | Evidence/limitations                                                          |
| --------------- | ----------------- | ------- | ----------------------------------------------------------------------------- |
| AC1–AC10        | Planned above     | Not run | Feature is not implemented; 0.22.1 tests do not establish these new behaviors |

## Delivery and remaining limitations

This is a draft for specification-driven development, not an implemented release. Current optional-login behavior remains unchanged. Product choices are agreed. Complete the technical session design before marking this specification Ready; acceptance tests remain unexecuted until implementation.

## Design references

- [OWASP session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN credentialed Fetch behavior](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN third-party cookie constraints](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies)

Use these references when finalizing the session ADR and verify the chosen hosting arrangement in browser integration tests.
