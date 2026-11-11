# Account workspaces and explicit synchronization

Status: accepted for 0.20. Baseline: main at `7dbf47b`.

## Decision

Keep the existing guest notebook and preference keys intact. Add optional account access configured through `VITE_API_BASE_URL`; an unconfigured static deployment remains a local notebook. Never embed a backend secret in Vite environment variables.

Use the existing email/password and short-lived bearer API. Tokens and passwords stay in memory, never local/session storage or URLs. Reload and expiry require authentication again. Logout discards the client token; an already copied bearer token remains valid until server expiry because this release has no revocation store. Account recovery, email verification, refresh tokens, OAuth and public backend hosting remain separate work.

Add owner-scoped notebook discovery because the API permits multiple notebooks. A user explicitly opens one notebook or creates a new one. Guest-to-account transfer creates another notebook only after confirmation and does not delete the guest copy.

Persist each account workspace under a key containing its authenticated owner ID and notebook ID. Its atomic envelope contains the current snapshot and the last acknowledged server revision/snapshot. Loading an untouched cache uses the latest server record. Loading a dirty cache preserves pending edits; a changed remote revision raises a conflict. Corrupt caches are preserved and must be exported before explicit recovery. If guest/account edits cannot be saved locally, workspace switching requires an export checkpoint matching the current snapshot.

Browser edits save locally. Remote synchronization is explicit, serialized and revision-checked. No last-write-wins retry follows a 409. Users can export their pending copy, explicitly load the remote version, or create a separate server copy. Logout/session expiry retain pending caches without copying account data into the guest notebook. Requests completing after unmount/session changes cannot replace another workspace.

## Trade-offs and security

Manual synchronization is less seamless than background synchronization but makes migration and overwrite decisions reviewable. The interface must clearly distinguish locally saved changes from server acknowledgements. Network, authentication, validation and storage errors retain user data and offer export/retry paths.

Caches are not encrypted. Accounts sharing a browser profile are not protected from someone inspecting that profile's storage. Ownership is always enforced by the API, never by client-provided ownership fields. Production requires an HTTPS API, explicit CORS origins, a stable random signing secret and remote PostgreSQL; GitHub Pages hosts only the frontend.

Domain/API/storage helpers remain independent of React. Feature hooks own session/workspace lifecycle; the app composes them. The previous guest persistence implementation remains the guest adapter, not a second account state.

## Validation

Cover authentication, owner-only discovery, schema rejection, untouched/dirty/corrupt cache loading, expiry, offline retry, revision conflicts, edits during requests, logout/account switching and guest preservation. Browser regressions must preserve existing local flows and design outside the new account controls. Validate a real frontend/API flow with isolated test storage in addition to mocked browser failures.
