# ADR 0006: Browser account access and renewable sessions

Status: Accepted for 0.23 implementation; verification is recorded in the feature spec.

## Context

Mandatory authentication must preserve existing notebooks and drafts while avoiding a password prompt after every reload. Existing API access tokens remain short-lived and tied to revocable database sessions. Frontend hosting and API hosting currently can be separate.

## Decision and contracts

Keep bearer authorization for notebook/privacy APIs. Browser login uses a separate renewal credential: 48 cryptographically random bytes, stored only as a SHA-256 digest on the server and an HttpOnly, SameSite=Strict cookie scoped to `/api/v1/auth/browser`. Production adds Secure and requires same-origin HTTPS frontend/API hosting (a reverse proxy may route the API). Local HTTP is supported only for development/test. A standalone GitHub Pages site with an unrelated API domain is not a supported persistent-login topology; do not rely on third-party cookies or persist bearer tokens in localStorage to work around it.

- `POST /auth/browser/login`: existing credential validation and throttling, new revocable session, access-token response plus renewal cookie.
- `POST /auth/browser/refresh`: require a valid renewal cookie, active owner and non-revoked/non-expired database session; atomically rotate the random credential and return a short-lived access token. Session expiry is absolute at 14 days, not extended on each refresh.
- `POST /auth/browser/logout`: revoke the cookie-bound session and clear the cookie without requiring an unexpired access token. Existing bearer logout and session revocation remain supported.
- `POST /auth/browser/bootstrap`: bearer authentication, owner serialization and first-owned-notebook selection, creating one empty notebook only when none exists. Repeated/concurrent calls must not create duplicates.

Renewal attempts have an independent bounded IP budget; ordinary reopening must not consume the password-attempt budget. Both remain subject to deployment edge limits.

All browser endpoints require an exact allowlisted Origin and `X-Tomohu-Request: 1`. Credentialed CORS permits only configured origins and headers; ordinary bearer API fetches continue to omit cookies. Origin and custom-header validation are required in addition to SameSite, including on login. Never echo credentials or log raw cookies. Database transactions commit before responses can issue a usable session or notebook.

One renewal is in flight per tab. PostgreSQL serializes concurrent rotations; a request presenting the immediately previous digest within ten seconds receives 409 without credentials or cookie changes. The client retries once with the browser's current cookie. Old credentials outside that window are rejected. No grace response issues a new bearer or renewal credential. A lost successful response can require reauthentication rather than weakening rotation checks. Session revocation/password reset invalidates subsequent renewal and bearer requests. It cannot recall already downloaded public data.

## UI and data lifecycle

Explicit states are startup verification, signed out, authenticated and offline read-only. A fresh browser or rejected session sees authentication, never a guest editor. Recovery links remain reachable. Do not treat any API error as permission to browse offline: only connection failures during an already loaded account session qualify. Confirmed authentication rejection and explicit logout close access. Reconnection renews and validates the same owner before allowing edits.

Only the loaded common notebook may be consulted during an outage; mutations/import/sync/private access are unavailable. Preserve pending public caches and in-memory private drafts. The offline mode is not encrypted storage or server authorization and does not promise cold-start offline loading; PWA support remains separate.

After login, bootstrap selects the first notebook, with existing local drafts loaded by the existing owner-scoped cache rules. Legacy guest storage stays byte-for-byte unchanged. Provide export without sign-in; explicit confirmation copies validated legacy data into a new account notebook. Failed copies never replace an existing destination. Account switching remains blocked while a private draft needs recovery.

A local explicit-sign-out marker prevents automatic re-entry after a failed server logout, while preserving caches. It is not an authentication credential and is cleared by explicit successful login. The UI reports unconfirmed remote revocation.

## Alternatives and consequences

- Memory-only bearer sessions force login on reload and do not meet the agreed continuity behavior.
- Persisting bearer/renewal credentials in web storage increases exposure to script access; it is not used.
- Cross-site renewal cookies depend on browser privacy policies. Require same-origin production deployment instead and report unsupported configuration clearly.
- A backend-for-frontend could provide the same deployment boundary later; no extra service is introduced in this release.
- Settings navigation, drag ordering and automatic public synchronization are independent features.

## Migration and rollback

Migration 06 adds `browser_renewals`, keyed to an existing auth session. Legacy sessions/notebooks remain unchanged. Apply migrations before deploying the API, then deploy the frontend. Existing users sign in once to establish renewal credentials. Back up and verify restoration before upgrading a persistent database.

Rollback must stop the new API/frontend first. Migration downgrade revokes browser sessions before dropping renewal state, so an old API cannot accept an access token under the extended session lifetime. All notebook data and ownership remain intact. Cached drafts must be exported/preserved before clearing site storage; do not treat clearing storage as rollback.

## Validation requirements

Test missing/untrusted origins, cookie attributes, rotation, concurrency, forged/expired/revoked credentials, password resets, transactional visibility, idempotent bootstrap, account isolation, legacy-data preservation, offline mutation guards and desktop/mobile recovery. Real PostgreSQL/API tests complement mock browser tests. Verify HTTPS/reverse-proxy hosting before production release; a localhost test does not establish production readiness.

References: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [MDN Fetch credentials](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [MDN third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).
