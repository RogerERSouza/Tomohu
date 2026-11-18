# Tomohu · v0.23.0

Organizador pessoal em React e TypeScript. Account-first notebook organization with public browser caches, explicit synchronization and private-item access control.

O repositório agora também contém a base de uma API em Python. O frontend atual continua na raiz durante esta fase; a futura migração para a árvore `frontend/` será planejada separadamente para não interromper o GitHub Pages.

## Executar no Windows

Requer Node.js 24 (o projeto foi verificado com Node.js 24.22.1).

Abra esta pasta no VS Code e execute no PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra o endereço informado pelo Vite, normalmente http://localhost:5173/.

## Experimentar

1. Na página inicial, crie uma seção com nome, emoji e cor.
2. Use os três pontinhos de um cartão para editar a seção.
3. Abra `Coisas para aprender → Cultivar violetas` para ver os conteúdos de exemplo.
4. Abra uma lista para marcar, adicionar, editar, excluir e reordenar itens.
5. Abra uma nota ou tutorial para escrever. Tutoriais aceitam texto livre e passos.
6. Use + e − no contador. Na página própria, veja data/hora e adicione uma anotação a cada registro, inclusive correções com −.
7. Crie um lembrete escolhendo primeiro se ele acontece em um dia ou vários; em vários dias, programe horários diários ou um evento contínuo e acompanhe o contador automático.
8. Atualize a página: as alterações são mantidas no mesmo navegador e endereço.
9. Abra Ajustes na barra inferior para exportar uma cópia JSON dos dados.

## Validação

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
```

The standard checks run domain and component regression suites. Also run the strict type and browser checks:

```powershell
npm.cmd run typecheck
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright builds the production frontend, starts its own preview on port 4173, and checks local and account scenarios at desktop (1280×900) and mobile (360×780) sizes. Docker and the API are not required for these frontend tests. Close any existing server on port 4173 first. Run `npx.cmd playwright show-report` to inspect the browser report. The mobile project emulates Chromium touch/viewport behavior; it is not a physical-device test.

## Account access

Configure the public API origin in the root `.env.local`, start the backend and apply migrations before using the app. Login/registration/recovery are now the entry screen; an unconfigured API no longer opens a guest editor. Registration bootstraps one empty notebook. Existing local notebooks can be exported before login or explicitly copied into the account afterward without deleting their source.

Browser sessions renew through an HttpOnly cookie with a fourteen-day absolute lifetime. Bearer tokens stay in memory. Public changes save to an isolated browser cache and require explicit synchronization. A loaded common notebook is read-only during an outage; private access requires connectivity. Explicit logout and authentication rejection close notebook access. See [the 0.23 validation and deployment guide](docs/versions/0.23.0.md).

Production requires same-origin HTTPS frontend/API routing for renewable sessions. GitHub Pages alone does not host the API or provide this routing for an unrelated API origin. PWA/offline cold-start support is deferred.

## Backend

The backend in [`backend/`](backend/) provides FastAPI authentication, PostgreSQL persistence, Alembic migrations, and owner-scoped notebook snapshots. The frontend requires account login, preserves legacy data for explicit recovery/copy and uses isolated caches with revision-checked synchronization. Follow [backend/README.md](backend/README.md) to configure PostgreSQL and apply migrations before calling the API.

No Windows, com Python 3.12 instalado:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

Abra http://127.0.0.1:8000/docs para a documentação interativa ou http://127.0.0.1:8000/health para verificar a API.

Para validar o backend:

```powershell
python -m ruff check .
python -m pytest
```

## Frontend organization

The frontend uses feature modules with a single notebook state owner. See [ADR 0002](docs/architecture/0002-frontend-feature-modules.md) for responsibilities, dependency rules, alternatives, and recovery.

- `src/app/`: shell, hash routes and dialog composition.
- `src/pages/`: page composition.
- `src/features/`: sections, contents, reminders, settings, search, backups and notebook state/persistence.
- `src/components/` and `src/hooks/`: reusable UI primitives and browser hooks.
- `src/lib/`, `src/types.ts`, `src/data/`: shared domain rules and contracts.
- `src/App.css` and `src/index.css`: preserved interface and global styles.

Use `npm.cmd run format` for Prettier. English identifiers and technical documentation are required; UI copy remains Portuguese. TypeScript strict mode and ESLint module boundaries are enforced.

## Planejamento

O [ROADMAP.md](ROADMAP.md) reúne as próximas entregas, ideias futuras e as regras de saúde do código do projeto.
As regras obrigatórias para alterações ficam em [AGENTS.md](AGENTS.md).

## Limites desta primeira versão

- Guest data and pending account caches stay in this browser/origin. Account data reaches the configured server only after an explicit copy or synchronization. Clearing site data can remove pending work. Exporte uma cópia JSON antes de alterações importantes; Ajustes também permite importar um backup válido com confirmação.
- Concurrent browser cache changes are detected and preserved for recovery; changes are not automatically merged across tabs or devices.
- Account access requires a separately running API configured with `VITE_API_BASE_URL`. Account recovery, email verification and session revocation are available in 0.21. Sharing and automatic background synchronization remain deferred.
- O aplicativo ainda não é uma PWA: não garante abrir sem internet depois que o servidor for encerrado. Persistência local não equivale a um aplicativo offline completo.
- Lembretes têm data local, duração de um ou vários dias, opção de dia todo, evento contínuo ou horários diários programados e contador automático até o próximo evento. Notificações do sistema ainda ficam para outra etapa.
- Seções e conteúdos podem ser excluídos com confirmação; ainda não há lixeira, movimentação entre seções nem reordenação manual de cartões. Itens de listas podem ser excluídos e reordenados.
- O contador impede números negativos. Correções são registradas com −; entradas do histórico não são apagadas.
- O exemplo de violetas é um roteiro de organização/pesquisa, não uma orientação de cultivo verificada.

## Versões e Git

`0.23.0` introduces mandatory account access and renewable browser sessions. GitHub Pages publishes only the frontend; persistent production accounts need same-origin HTTPS API routing. The [release guide](docs/versions/0.23.0.md) documents migration, testing and deployment constraints.

Commits futuros: `feat: add ...`, `fix: correct ...`, `refactor: extract ...`. Uma versão pode reunir vários commits.

## 0.22.0 privacy

Account owners can configure an independent privacy password after verifying their email. Protected section trees and individual content live outside public notebook snapshots and require a short-lived unlock grant. Choose locked cards in the original location or a dedicated area. Private items open in the normal notebook screens after a compact password prompt. Private edits save automatically to the account; private exports are readable JSON. This is application access control, not end-to-end encryption, and older public copies cannot be recalled. See [the validation guide](docs/versions/0.22.0.md) and [ADR 0005](docs/architecture/0005-private-aggregates.md).

## Development process

Follow [the specification-driven workflow](docs/development/workflow.md) alongside [AGENTS.md](AGENTS.md). Significant features use [a compact specification template](docs/specs/_template.md) with acceptance scenarios, implementation tasks and recorded validation evidence. The [mandatory-account specification](docs/specs/mandatory-accounts.md) is a draft for the next authentication change, not an implemented feature.
