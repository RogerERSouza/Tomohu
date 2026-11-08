# ADR 0001: API authentication and notebook ownership

Status: accepted for 0.18. Local PostgreSQL 17 verification completed on 2026-11-08; see the release validation record. Production readiness remains a separate operational review.

## Context

The 0.17 API stores notebook snapshots without accounts. The experimental integration branch sent synthetic data to anonymous local endpoints. Account isolation must precede synchronization. The active browser notebook must remain untouched.

## Decision

Keep the existing layered FastAPI backend. Add a User SQLAlchemy model, credentials/response contracts, an AuthService, a UserRepository, a bearer-token dependency, and an additive Alembic migration. Routers own HTTP responses; services own use cases. Notebook queries always include the authenticated owner ID. No separate controller pass-through class is necessary.

Use pwdlib's recommended Argon2id configuration and PyJWT with an explicit HS256 algorithm allowlist. Tokens contain an opaque user UUID, issuer, audience, issued-at, not-before, expiry, token type, and token UUID. Default lifetime is 15 minutes (maximum configuration: 30). Passwords have 15–128 characters without composition rules or trimming. Email identifiers are normalized and case-insensitive, including their local part; database uniqueness and a lowercase constraint enforce the policy.

Registration returns public account data; login returns a bearer token. This is a JSON credentials API, not a complete OAuth authorization server. Requests use Authorization: Bearer, not URL tokens or cookies. Browser token storage is intentionally undecided until frontend integration. No refresh token is issued.

A request-scoped SQLAlchemy transaction is shared by authentication and the notebook operation. Concurrent snapshot writes continue to use SQLAlchemy version checking; stale writers receive 409.

## Legacy data and migrations

Add nullable owner_id with a foreign key and index. Existing snapshots retain their exact payload and revision and remain inaccessible through authenticated endpoints while their owner is NULL. Registration never claims them. Future import requires explicit consent and verified backups; UUID knowledge never proves ownership.

Downgrade is supported only while no accounts exist. It refuses to erase users and ownership after account creation. Recover a populated installation through a verified backup and explicit migration, not an automatic destructive downgrade. Application deployments must coordinate the API and migration; the old anonymous API must not continue serving these records.

## Alternatives

- Copy the academic Flutter/Flask structure: rejected as a rigid requirement. Preserve responsibility boundaries while using React hooks and FastAPI dependencies naturally.
- Put SQLAlchemy queries in HTTP routers or models: rejected to retain the existing repository boundary.
- Assign every legacy snapshot to the first registered account: rejected because ownership cannot be established.
- Supabase Auth: viable future identity provider, but not selected for this learning-focused Python authentication milestone.
- Refresh tokens or persisted session revocation: deferred to the account lifecycle design before public frontend integration.

## Security and limits

Missing/invalid/expired tokens return 401; disabled accounts return 403; another owner's notebook and a missing notebook both return 404. Account state is checked on every authenticated request. Login failures share the same message and perform an Argon2 verification for unknown accounts. Registration returns 409 for duplicate email, which discloses availability; this trade-off must be reconsidered with verification/recovery UX before public launch.

Validation errors omit submitted inputs and contexts. Private API responses are no-store. CORS uses explicit origins, with HTTPS origins and a mandatory secret in production. A generated development secret changes between application instances unless configured persistently.

A bounded in-memory limiter provides per-IP and per-account limits. It resets on restart and is not shared between workers. A production gateway must enforce shared abuse/request-size limits, TLS, and trusted-proxy settings. This milestone does not establish public production readiness: verified email, account recovery, revocation/logout semantics, password change, breached-password checks, production monitoring, and backup recovery remain future work. A stolen token remains usable until expiry unless the account is disabled or the signing key is rotated.

## Release boundaries

0.18: backend authentication and ownership. 0.19: frontend refactoring with regression tests. Authenticated UI integration/synchronization is planned for 0.20 and requires a separate design. The current snapshot schema remains version 1; no browser storage keys or notebook payloads change.

## References

- https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://react.dev/learn/reusing-logic-with-custom-hooks
