# Tomohu · v0.18.0

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

Os testes verificam histórico do contador, hierarquia de seções, criação de conteúdos e validação dos dados salvos.

## Backend

The backend in [`backend/`](backend/) provides FastAPI authentication, PostgreSQL persistence, Alembic migrations, and owner-scoped notebook snapshots. The frontend still uses browser storage; account UI and synchronization are future releases. Follow [backend/README.md](backend/README.md) to configure PostgreSQL and apply migrations before calling the API.

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

## Organização do código

- `src/types.ts`: tipos dos dados, incluindo conteúdos diferenciados por `kind`.
- `src/data/initialNotebook.ts`: conteúdo de demonstração do primeiro acesso.
- `src/lib/notebook.ts`: funções de domínio e validação do armazenamento.
- `src/hooks/useNotebook.ts`: carregamento e salvamento em localStorage.
- `src/components/`: cartões, editor, ícones e modal acessível.
- `src/App.tsx`: navegação, página inicial e coordenação das ações.
- `src/App.css` e `src/index.css`: estilos da interface e regras globais.

`npm.cmd run format` aplica a formatação com Prettier.

Nomes de código em inglês; textos de interface em português. Componentes usam PascalCase, funções/variáveis camelCase e classes CSS kebab-case.

## Planejamento

O [ROADMAP.md](ROADMAP.md) reúne as próximas entregas, ideias futuras e as regras de saúde do código do projeto.
As regras obrigatórias para alterações ficam em [AGENTS.md](AGENTS.md).

## Limites desta primeira versão

- Os dados ficam somente neste navegador e origem (protocolo, host e porta). Limpar os dados do site pode removê-los. A exportação JSON é uma cópia dos dados; ainda não há importação pela interface.
- Use uma aba por vez: ainda não há sincronização de alterações entre abas ou dispositivos.
- The frontend has no login screen, cloud synchronization, sharing or account recovery yet. Backend authentication is available for API clients.
- O aplicativo ainda não é uma PWA: não garante abrir sem internet depois que o servidor for encerrado. Persistência local não equivale a um aplicativo offline completo.
- Lembretes têm data local, duração de um ou vários dias, opção de dia todo, evento contínuo ou horários diários programados e contador automático até o próximo evento. Notificações do sistema ainda ficam para outra etapa.
- Ainda não há exclusão/lixeira de seções e conteúdos, movimentação entre seções nem reordenação de cartões. Itens de listas podem ser excluídos e reordenados.
- O contador impede números negativos. Correções são registradas com −; entradas do histórico não são apagadas.
- O exemplo de violetas é um roteiro de organização/pesquisa, não uma orientação de cultivo verificada.

## Versões e Git

`0.18.0` identifies this backend authentication milestone. GitHub Pages publishes the frontend after a push to `main`. Version `0.19.0` is reserved for frontend refactoring; account integration and synchronization follow separately.

Commits futuros: `feat: add ...`, `fix: correct ...`, `refactor: extract ...`. Uma versão pode reunir vários commits.
