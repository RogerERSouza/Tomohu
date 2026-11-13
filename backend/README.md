# Tomohu API · 0.21.0

FastAPI, SQLAlchemy, PostgreSQL and Alembic. The frontend now supports optional authenticated workspaces and explicit synchronization, while guest data and pending account edits remain safely separated in browser storage.

## Run locally (Windows PowerShell)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
# Docker Desktop must be running:
docker compose up -d
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1
```

If a virtual environment and .env already exist, reuse them. Do not overwrite existing configuration or initialize another database. On macOS/Linux, activate with `source .venv/bin/activate` and copy the example with `cp` only when needed.

The application never creates tables on startup. Apply migrations before using `/docs`. `/health` checks a database connection with SELECT 1; it does not verify that migrations are current or that every table is usable.

## Authentication contract

| Method | Endpoint                 | Input / result                                             |
| ------ | ------------------------ | ---------------------------------------------------------- |
| POST   | `/api/v1/auth/register`  | JSON email/password; public account response, 201          |
| POST   | `/api/v1/auth/login`     | JSON email/password; access_token, token_type, expires_in  |
| GET    | `/api/v1/auth/me`        | Bearer token; public account                               |
| POST   | `/api/v1/notebooks`      | Bearer token and snapshot; owner comes from authentication |
| GET    | `/api/v1/notebooks/{id}` | Bearer token; only the owner can read                      |
| PUT    | `/api/v1/notebooks/{id}` | Bearer token, revision and snapshot; 409 on stale revision |

New passwords contain 5–128 characters with an ASCII uppercase letter, lowercase letter and digit; existing passwords remain valid for login. Passwords are stored only as salted Argon2id hashes. Email identifiers are case-insensitive. Unknown account and wrong password return the same 401. Duplicate registration returns 409. Tokens expire after 15 minutes by default; no refresh tokens are issued, and the frontend keeps bearer tokens only in memory.

Use Swagger `/docs`: register, login, copy access_token, click Authorize and paste the token value (the HTTP Bearer scheme adds the prefix). Then call `/auth/me` or create a synthetic notebook. Never send real personal data to an unreviewed public deployment.

## Configuration

| Variable                    | Policy                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| TOMOHU_ENVIRONMENT          | development, test or production                                              |
| TOMOHU_DATABASE_URL         | Local PostgreSQL by default; remote Supabase later with TLS                  |
| TOMOHU_CORS_ORIGINS         | Explicit comma-separated frontend origins; production requires HTTPS origins |
| TOMOHU_JWT_SECRET           | Generate a random secret with at least 32 bytes; mandatory in production     |
| TOMOHU_ACCESS_TOKEN_MINUTES | Default 15; allowed range 1–30                                               |

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`, then save it only in the untracked .env or deployment secret manager. Never commit it. An empty development secret produces a fresh application-instance key, invalidating tokens after a restart. The old TOMOHU_ALLOW_ANONYMOUS_NOTEBOOKS flag is removed and cannot bypass authentication.

Supabase remains a future PostgreSQL host, not a new database API. Changing the connection URL does not transfer records. Keep credentials outside the browser and use provider-recommended TLS and pooling.

## Existing data and recovery

Migration 20261107_02 adds users and notebook ownership. Old anonymous snapshots are preserved with owner_id NULL and quarantined from the API. They are not assigned to any new account. Browser data is unchanged. Do not run the old anonymous API against the upgraded database.

Before migration, stop writes and make a PostgreSQL backup using a client compatible with the server version. Restore the backup into a separate database, verify counts and representative snapshots, and only then treat it as recoverable. Keep an independent copy. Migrations version schema; they are not backups.

The migration downgrade refuses to remove accounts once any user exists. For populated databases, use an explicit recovery/migration plan. Never delete accounts just to force a downgrade through.

## Validation

```powershell
python -m ruff check .
python -m ruff format --check .
python -m pytest
```

The default test suite uses temporary SQLite files for fast feedback. To run the same contract, migrations, and ownership tests on native PostgreSQL, create an empty dedicated database named `tomohu_test` and set:

```powershell
$env:TOMOHU_TEST_DATABASE_URL = 'postgresql+psycopg://tomohu:tomohu@localhost:5432/tomohu_test'
python -m pytest
Remove-Item Env:TOMOHU_TEST_DATABASE_URL
```

The database name must end in `_test`. Each test creates its own random schema and removes that schema afterwards. The test account must be allowed to create schemas. Never point this variable at a production database. CI includes PostgreSQL 17 integration checks. Tests cover additive upgrades with legacy data, guarded downgrade, schema/model agreement, database constraints, authentication, disabled accounts, token validation, owner isolation, optimistic concurrency, CORS, validation redaction and abuse limits.

## Structure and boundaries

- `app/api/`: routers and shared bearer/session dependencies.
- `app/schemas/`: request/response contracts.
- `app/services/`: account and notebook use cases.
- `app/repositories/`: database queries.
- `app/models/`: SQLAlchemy mappings.
- `app/core/`: configuration, hashing/token primitives, transactions and rate limits.
- `migrations/`: reviewed Alembic schema history.

See [ADR 0001](../docs/architecture/0001-authentication-and-notebook-ownership.md) for security trade-offs and deferred production requirements. Account recovery, verified email and logout/revocation are covered by [ADR 0004](../docs/architecture/0004-account-lifecycle.md). Shared production rate limiting remains deferred.

## 0.20 account integration

`GET /api/v1/notebooks` returns only the authenticated owner's notebook IDs, revisions and a display title derived from the first section, in stable creation order. It requires the same bearer authentication as notebook reads and writes and never lists quarantined anonymous records. No new database migration is needed.

Snapshot create/replace now validate calendar values, reminder intervals, nested identifiers and finite/nonnegative counter totals in addition to hierarchy/ownership rules. Rejected replacements leave the existing revision unchanged. API size limits still apply; the frontend checks these before upload without truncating guest data.

The frontend uses memory-only tokens and explicit synchronization. Configure development CORS for the frontend origin (default localhost/127.0.0.1 port 5173); integration tests use port 4173. A deployed frontend requires an independently deployed HTTPS API and explicit production CORS, PostgreSQL and a stable signing secret.

## 0.21 account lifecycle

Run `python -m alembic upgrade head` before starting this API. Migration 03 preserves
existing passwords, notebook IDs, ownership, snapshots and revisions. Previously
issued bearer tokens must sign in again because they have no database session.

Configure a stable `TOMOHU_JWT_SECRET` in `backend/.env` and the correct
`TOMOHU_FRONTEND_URL`, including the frontend base path. API and mail worker MUST
share the same database and secret. Start the worker in another terminal with
`python -m app.email_worker`, or deliver one batch with `--once`. Without the
worker, requests are queued but no email is delivered. The worker refuses to run
with an automatically generated ephemeral secret.

Local default: `TOMOHU_MAIL_MODE=outbox` creates ignored private `.eml` files in
`backend/.outbox`. Open a file as text and copy its link into the browser. Do not
commit, publish or share those files. Links expire 30 minutes after creation.
Production requires HTTPS frontend, explicit CORS, stable secret and `smtp` mode
with host, username, password, sender and STARTTLS port (usually 587). Implicit TLS
port 465 is not supported. Run one worker for SQLite; PostgreSQL workers coordinate
with row locks. Delivery retries at most five times while the link is valid. A
worker crash after SMTP acceptance may cause duplicate delivery of the same link;
confirmation is still single-use. Monitor failed/expired queue records.

Routes under `/api/v1/auth`: `POST password/reset-request`, `POST password/reset`,
`POST password/change`, `POST email/request`, `POST email/verify`, `GET sessions`,
`DELETE sessions/{id}`, `POST sessions/revoke-all` and `POST logout`. Authenticated
routes use the same memory-only bearer header. There are no refresh cookies.
Password changes/resets revoke all sessions without deleting browser copies.
Revocation blocks subsequent requests, not requests already in flight or data
already downloaded. Verification is informative in 0.21; it does not newly lock
out legacy accounts. Account existence during registration still returns 409,
while reset requests intentionally return a generic 202.

## Privacy (0.22.0)

Migration `20261112_04` adds independent Argon2 privacy credentials and private aggregates. `/api/v1/privacy` requires the account bearer token; protected operations additionally require `X-Privacy-Token`. The five-minute grant binds the current account session and privacy credential version. Setup and email recovery require a verified address. Email worker links use purpose `private`; no new environment secrets are required. The private JSON is access controlled, not end-to-end encrypted. Back up the whole PostgreSQL database to include private aggregates. Run `python scripts/run_live_e2e.py --suite privacy` from the repository root with the dedicated E2E database URL for real recovery coverage.

Migration `20261112_05` adds private sibling positions. Privacy create/protect/restore return the new public notebook in the same committed response. New private roots can be created directly with `POST /api/v1/privacy/notebooks/{id}/create`; all private writes remain revision checked. Five consecutive failed unlock attempts are limited separately from settings/recovery requests; successful unlocks do not exhaust ordinary per-item navigation.
