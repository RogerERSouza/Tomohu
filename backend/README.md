# Backend do Tomohu

Esta pasta concentra a API do Tomohu. O frontend permanece separado e continua usando `localStorage` até a etapa de sincronização planejada.

## Estrutura

```text
backend/
├── app/
│   ├── api/            # Rotas HTTP e versionamento futuro
│   ├── core/           # Configurações e preocupações transversais
│   ├── models/         # Modelos SQLAlchemy persistidos
│   ├── repositories/   # Consultas ao banco
│   ├── schemas/        # Contratos de entrada e saída da API
│   ├── services/       # Regras de negócio e validação
│   └── main.py         # Criação da aplicação FastAPI
├── migrations/         # Histórico versionado do banco (Alembic)
├── tests/
├── .env.example
└── pyproject.toml
```

## Executar

Crie um ambiente virtual, instale as dependências de desenvolvimento e inicie a API:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\Activate.ps1
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

Use `GET /health` para verificar a API e `/docs` para abrir a documentação automática.

## Banco de dados

O banco do Tomohu é PostgreSQL desde o desenvolvimento local. Para iniciar uma cópia sem instalar o PostgreSQL diretamente no computador, com Docker Desktop aberto:

```bash
docker compose up -d
cp .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
python -m alembic upgrade head
```

O primeiro migration cria a tabela `notebooks`, usando `JSONB` no PostgreSQL. Ela guarda um snapshot validado do caderno atual, preservando o formato que já existe no frontend e permitindo salvar/carregar de forma atômica. Cada gravação usa uma `revision`; se duas cópias tentarem salvar ao mesmo tempo, a API responde `409 Conflict` em vez de apagar uma alteração silenciosamente.

Para produção, o destino previsto é o PostgreSQL remoto do Supabase. A configuração muda somente por `TOMOHU_DATABASE_URL`, com SSL obrigatório na URL fornecida pelo Supabase; modelos, migrations, serviços e repositórios permanecem os mesmos. Nunca copie a URL de produção para arquivos versionados.

### Rotas já disponíveis

- `POST /api/v1/notebooks`: cria um caderno a partir de um backup/snapshot válido.
- `GET /api/v1/notebooks/{id}`: carrega o snapshot salvo.
- `PUT /api/v1/notebooks/{id}`: substitui o snapshot com a `revision` atual.

O frontend ainda não chama estas rotas: essa ligação será uma entrega própria, com migração segura dos dados já existentes em `localStorage` e plano de backup antes da primeira sincronização.

## Regras desta fase

- Nenhum segredo entra no Git: copie `.env.example` para `.env` quando for necessário.
- Ainda não há login, conta ou sincronização automática entre dispositivos. Por isso, cadernos anônimos só ficam ativos em desenvolvimento/teste; em produção ficam desativados até a autenticação e a autorização por conta existirem.
- Nunca coloque senhas, URLs reais de produção ou arquivos `.env` no Git.
