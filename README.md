# Tomohu · v0.21.0

Organizador pessoal em React e TypeScript. Primeira versão funcional, com armazenamento local e visual baseado no protótipo azul-escuro do Figma.

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

The standard checks run 26 domain/collection tests and 10 component/persistence tests. Also run the strict type and browser checks:

```powershell
npm.cmd run typecheck
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright builds the production frontend, starts its own preview on port 4173, and checks local and account scenarios at desktop (1280×900) and mobile (360×780) sizes. Docker and the API are not required for these frontend tests. Close any existing server on port 4173 first. Run `npx.cmd playwright show-report` to inspect the browser report. The mobile project emulates Chromium touch/viewport behavior; it is not a physical-device test.

## Enable local accounts

Copy `.env.example` to `.env.local` at the repository root and restart Vite. The public `VITE_API_BASE_URL` value is an origin, such as `http://127.0.0.1:8000`, without `/api` or credentials. Start the backend separately and open **Ajustes → Conta e cadernos**. Logging in never uploads guest data automatically. Select an account notebook, create an empty one, or explicitly confirm sending a separate copy. Edits save locally; **Sincronizar agora** sends them to the account.

Tokens are memory-only: reload or expiry requires login again. Guest data and pending account caches are retained separately. Export before resolving conflicts or clearing site storage.

Run the real API/browser integration with `backend/.venv` Python: `python scripts/run_live_e2e.py` from the root. It starts a temporary isolated SQLite API and tests registration, transfer and synchronization on desktop/mobile. Stop an existing API on port 8000 first. Set `TOMOHU_E2E_DATABASE_URL` to a dedicated PostgreSQL database ending in `_test` for PostgreSQL integration, as CI does.

## Backend

The backend in [`backend/`](backend/) provides FastAPI authentication, PostgreSQL persistence, Alembic migrations, and owner-scoped notebook snapshots. The frontend supports optional account login, isolated account caches and explicit revision-checked synchronization. Without a configured API origin, it remains a local notebook. Follow [backend/README.md](backend/README.md) to configure PostgreSQL and apply migrations before calling the API.

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
- Use uma aba por vez: ainda não há sincronização de alterações entre abas ou dispositivos.
- Account login and manual synchronization require a separately running API configured with `VITE_API_BASE_URL`. Account recovery, email verification and session revocation are available in 0.21. Sharing and automatic background synchronization remain deferred.
- O aplicativo ainda não é uma PWA: não garante abrir sem internet depois que o servidor for encerrado. Persistência local não equivale a um aplicativo offline completo.
- Lembretes têm data local, duração de um ou vários dias, opção de dia todo, evento contínuo ou horários diários programados e contador automático até o próximo evento. Notificações do sistema ainda ficam para outra etapa.
- Seções e conteúdos podem ser excluídos com confirmação; ainda não há lixeira, movimentação entre seções nem reordenação manual de cartões. Itens de listas podem ser excluídos e reordenados.
- O contador impede números negativos. Correções são registradas com −; entradas do histórico não são apagadas.
- O exemplo de violetas é um roteiro de organização/pesquisa, não uma orientação de cultivo verificada.

## Versões e Git

`0.21.0` adds email verification, password recovery/change and revocable sessions. Account workspaces and explicit synchronization from 0.20 remain unchanged. GitHub Pages publishes only the frontend. Set the repository variable `TOMOHU_API_BASE_URL` to a deployed HTTPS API origin to enable accounts there; leaving it empty preserves local mode. See the [0.21 release and Windows validation guide](docs/versions/0.21.0.md) and [ADR 0003](docs/architecture/0003-account-workspaces-and-explicit-sync.md).

Commits futuros: `feat: add ...`, `fix: correct ...`, `refactor: extract ...`. Uma versão pode reunir vários commits.

## 0.22.0 privacy

Account owners can configure an independent privacy password after verifying their email. Protected section trees and individual content live outside public notebook snapshots and require a short-lived unlock grant. Choose locked cards in the original location or a dedicated area. Private items open in the normal notebook screens after a compact password prompt. Private edits save automatically to the account; private exports are readable JSON. This is application access control, not end-to-end encryption, and older public copies cannot be recalled. See [the validation guide](docs/versions/0.22.0.md) and [ADR 0005](docs/architecture/0005-private-aggregates.md).
