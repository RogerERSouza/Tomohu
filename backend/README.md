# Tomohu API · 0.20.0

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

Passwords contain 15–128 characters and are stored only as salted Argon2id hashes. Email identifiers are case-insensitive. Unknown account and wrong password return the same 401. Duplicate registration returns 409. Tokens expire after 15 minutes by default; no refresh tokens are issued, and the frontend keeps bearer tokens only in memory.

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

See [ADR 0001](../docs/architecture/0001-authentication-and-notebook-ownership.md) for security trade-offs and deferred production requirements. Account recovery, verified email, logout/revocation and shared production rate limiting remain outside the 0.20 integration scope.

## 0.20 account integration

`GET /api/v1/notebooks` returns only the authenticated owner's notebook IDs, revisions and a display title derived from the first section, in stable creation order. It requires the same bearer authentication as notebook reads and writes and never lists quarantined anonymous records. No new database migration is needed.

Snapshot create/replace now validate calendar values, reminder intervals, nested identifiers and finite/nonnegative counter totals in addition to hierarchy/ownership rules. Rejected replacements leave the existing revision unchanged. API size limits still apply; the frontend checks these before upload without truncating guest data.

The frontend uses memory-only tokens and explicit synchronization. Configure development CORS for the frontend origin (default localhost/127.0.0.1 port 5173); integration tests use port 4173. A deployed frontend requires an independently deployed HTTPS API and explicit production CORS, PostgreSQL and a stable signing secret.
