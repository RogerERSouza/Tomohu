# Backend do Tomohu

Esta pasta concentra a API do Tomohu. O frontend permanece separado e continua usando `localStorage` até a etapa de sincronização planejada.

## Estrutura

```text
backend/
├── app/
│   ├── api/            # Rotas HTTP e versionamento futuro
│   ├── core/           # Configurações e preocupações transversais
│   ├── models/         # Modelos persistidos no banco (próxima etapa)
│   ├── repositories/   # Consultas ao banco (próxima etapa)
│   ├── schemas/        # Contratos de entrada e saída da API
│   ├── services/       # Regras de negócio
│   └── main.py         # Criação da aplicação FastAPI
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

## Regras desta fase

- Nenhum segredo entra no Git: copie `.env.example` para `.env` quando for necessário.
- Ainda não há banco, login ou dados de usuário.
- A próxima etapa define PostgreSQL, SQLAlchemy, migrações e o primeiro domínio persistido.
