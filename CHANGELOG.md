# Histórico de versões

## 0.20.0 — 2026-11-09

### Fixed after branch review

- Block overlapping imports and ignore destructive remote responses after local edits or another tab changes the account cache.
- Preserve external drafts until a new explicit recovery, including delayed storage events; retain browser recovery/export controls.
- Omit nullable optional reminder fields and include root section parents in API responses, including previously stored snapshots.
- Normalize legacy counter timestamps only in outbound account copies; compare equivalent timestamps and object key orders without false pending-sync status.
- Add shared API/frontend contract fixtures, controller regressions and real two-tab browser coverage. See `docs/versions/0.20.0-review-fixes.md`.

### Added

- Optional account registration/login, owner-scoped notebook discovery and explicit guest-copy transfer without changing the guest notebook.
- Isolated account caches, manual revision-checked synchronization, pending-edit recovery and conflict/export/reload controls.
- Memory-only short-lived sessions, API contract/size validation, network retry and cross-tab preservation warnings.
- Mocked account browser regressions and real API/browser integration, with PostgreSQL integration configured in CI.

### Changed

- Separate workspace composition from notebook rendering; keep form state, session, API and persistence responsibilities in their feature modules.
- Align backend snapshot value validation with frontend integrity rules; preserve current data on rejected replacements.
- Support a public API origin through `VITE_API_BASE_URL` or the Pages repository variable `TOMOHU_API_BASE_URL`. Unconfigured deployments stay local.

## 0.19.0 — 2026-11-09

### Fixed after branch review

- Reject impossible reminder dates/times, duplicate scoped IDs, broken section references, parent cycles, and invalid counter totals before loading or importing snapshots.
- Apply the same continuous-interval rule to imports and the reminder form, including multi-day selection with equal dates; preserve valid overnight intervals.
- Keep invalid calendar values from crashing the application and reject nonfinite counter updates.
- Keep snapshot validation in a React-independent module; remove the former inline validator and reuse pure date/time rules. See `docs/versions/0.19.0-validation-fixes.md`.
- Resume autosave after a confirmed backup recovery; failed replacement keeps the preservation block active.
- Initialize timed-event defaults from valid scheduled or legacy times when converting an all-day reminder.
- Reject unparseable counter-history timestamps before importing; invalid dates also have a safe editor display fallback.
- Keep section tag controls inside narrow mobile dialogs in both themes.
- Add regression coverage for the four reproduced defects; see `docs/versions/0.19.0-review-fixes.md`.

### Changed

- Extract frontend app composition, pages, feature UI, preferences, collection selection, notebook actions and storage/file adapters.
- Preserve notebook schema, browser keys, hash routes, markup, styles and confirmation behavior.
- Enable TypeScript strict mode, type-check tests, and enforce module dependency direction with ESLint.
- Read the version displayed in Settings from package metadata instead of the stale 0.17 label.
- Use Node 24 consistently in frontend validation and Pages workflows.

### Added

- Component/persistence interaction tests and desktop/mobile Chromium browser regressions, established before extraction and repeated afterwards.
- Production-preview browser checks in CI with failure artifacts.
- Frontend architecture and release validation/recovery records.

## 0.18.0 — 2026-11-07

### Added

- Backend registration, login and authenticated identity with Argon2id and short-lived bearer JWTs.
- Account-scoped notebook queries and an additive ownership migration that preserves anonymous legacy records without granting access.
- Authentication, ownership, migration and concurrency regression coverage; dedicated PostgreSQL integration checks in CI.
- Architecture decision and API contracts to support the later frontend refactor and integration.

### Changed

- Anonymous notebook access is removed. Missing authentication is 401; foreign-owned resources are indistinguishable from missing resources (404).
- Frontend behavior remains at the stable local-storage implementation; experimental anonymous API controls are removed when applying over the earlier 0.18 branch.
- 0.19 is reserved for frontend refactoring; synchronization is planned as a separate later milestone.

### Migration notes

- Apply Alembic migrations after a verified backup. Existing unowned snapshots remain preserved and inaccessible through the API.
- Downgrade refuses destructive removal once accounts exist. Public production account lifecycle and frontend token storage remain future work.

## 0.17.0 — 2026-11-07

### Adicionado

- Persistência do backend com PostgreSQL desde o desenvolvimento local, SQLAlchemy, migrations versionadas por Alembic e preparação para PostgreSQL remoto no Supabase.
- API versionada de cadernos (`POST`, `GET` e `PUT`) que valida o formato já usado pelo Tomohu antes de salvar.
- Controle de revisão para impedir que duas cópias do app sobrescrevam dados uma da outra silenciosamente.

### Segurança e estabilidade

- A API testa a disponibilidade do banco em `GET /health` sem expor configuração sensível.
- Sem autenticação, as rotas de caderno anônimo são bloqueadas automaticamente em produção.
- Testes de criação, leitura, atualização, conflito de revisão e dados inválidos para o núcleo persistido.

## 0.16.0 — 2026-11-06

### Adicionado

- Base inicial do backend em Python com FastAPI, separada do frontend atual.
- Configuração por variáveis de ambiente, CORS com origens explícitas e rota `GET /health`.
- Testes e ferramentas de qualidade próprios para o backend.

## 0.11.1 — 2026-10-30

### Corrigido

- Expandir uma checklist ou tutorial não estica mais os outros cartões da mesma linha.

### Adicionado

- Checklists expandidas agora permitem marcar e desmarcar itens diretamente na seção, com caixas maiores e mais fáceis de tocar.

## 0.11.0 — 2026-10-30

### Adicionado

- Checklists e tutoriais agora expandem dentro da seção para mostrar todos os itens e recolhem novamente pelo mesmo cartão.
- A abertura tem transição de altura, conteúdo e seta; o botão “Abrir para editar” mantém a página completa disponível para alterações.

## 0.10.2 — 2026-10-29

### Alterado

- Bordas rasgadas sutis foram adicionadas a diferentes modelos de nota, inclusive na lateral de um deles, sem comprometer a leitura.

## 0.10.1 — 2026-10-29

### Alterado

- Cartões de lembrete ficaram menores e quase quadrados, mantendo apenas uma leve altura extra para leitura.
- A faixa superior agora alterna quatro modelos de papel compatíveis com o Tomohu: fita, clipe, espiral e borda rasgada.

## 0.10.0 — 2026-10-29

### Alterado

- Cartões de lembrete foram redesenhados para um formato vertical de nota, com mais espaço para leitura e menos aparência de bloco genérico.
- Data, título e tempo restante agora têm hierarquia visual própria; a fita e a textura de papel também receberam mais detalhe.

## 0.9.0 — 2026-10-29

### Adicionado

- Seções podem ser fixadas no topo pelo ícone de estrela; um segundo toque remove o favorito.
- Favoritas ficam primeiro mesmo ao ordenar por recentes, antigas ou A–Z, sem mudar a ordem entre as demais seções.
- Backups antigos continuam compatíveis: a preferência de favorito é opcional.

## 0.8.0 — 2026-10-29

### Adicionado

- Checklists e tutoriais agora mostram progresso visual com quantidade concluída, porcentagem e barra de avanço.
- O progresso aparece tanto no cartão de prévia quanto dentro da lista, atualizando ao marcar ou desmarcar itens.

## 0.7.0 — 2026-10-29

### Adicionado

- Transições curtas entre páginas ao abrir seções e conteúdos em navegadores compatíveis.
- Animações leves para entrada de cartões, menu de ordenação, calendário, seletores de hora, painéis e modais.
- Resposta visual ao pressionar botões, cartões e ícones, deixando as ações mais claras sem pesar a interface.
- A preferência do sistema por reduzir movimentos agora desativa animações e transições do Tomohu de forma abrangente.

## 0.6.3 — 2026-10-28

### Corrigido

- O ícone de ordenação agora tem as duas setas separadas, deixando o sentido de organizar mais claro.

## 0.6.2 — 2026-10-28

### Alterado

- O botão de ordenação agora usa um ícone vertical de setas, alinhado ao padrão dos demais ícones do app.
- O menu de ordenação e os formulários receberam uma ampliação leve para melhorar a leitura no PC.
- Adicionada a ordenação “Mais antigas”; “Mais recentes” agora coloca primeiro as seções criadas por último.

## 0.6.1 — 2026-10-28

### Alterado

- A ordenação agora usa um único menu de “Ordenar e filtrar”, mais claro e integrado ao visual do Tomohu.
- Seções podem ser filtradas pelas cores que já existem na tela atual; ao trocar de seção, o filtro é limpo para não esconder conteúdo inesperadamente.
- O menu aparece com uma animação leve e respeita a preferência do sistema por reduzir movimentos.

## 0.6.0 — 2026-10-28

### Adicionado

- Ajustes agora permitem importar um backup JSON válido do Tomohu.
- Antes de substituir os dados atuais, o app valida o arquivo, pede confirmação e oferece exportar uma cópia de segurança.
- Um backup importado também consegue recuperar o salvamento quando os dados locais anteriores não puderem ser lidos.

## 0.5.5 — 2026-10-28

### Adicionado

- Eventos de dia específico agora podem usar “Um horário”: um aviso pontual com data e hora, sem exigir duração.

## 0.5.4 — 2026-10-28

### Adicionado

- Ao abrir um lembrete encerrado, uma decisão própria permite excluí-lo ou seguir para alterar sua data.
- Formulários de seção, conteúdo e lembrete agora explicam em vermelho quando falta um título para salvar.

## 0.5.3 — 2026-10-28

### Corrigido

- O modal esconde as barras de rolagem visualmente sem impedir a rolagem em telas menores.
- Painéis de horário não criam mais rolagem lateral e o painel da segunda hora abre para dentro do modal.
- O aviso de horário duplicado aparece abaixo de “Novo horário” apenas após a tentativa de adicionar um alarme repetido.
- Ao editar um lembrete, a ação de concluir ficou antes das configurações de salvamento.

## 0.5.2 — 2026-10-28

### Corrigido

- Horários programados mostram o aviso de que alarmes duplicados não são aceitos.
- Apenas um painel de seleção de horário pode ficar aberto por vez.
- Ao abrir outro horário ou remover um item, o painel anterior fecha mantendo o valor já escolhido.

## 0.5.1 — 2026-10-28

### Corrigido

- Texto das escolhas de data e horário ficou mais claro no formulário de lembretes.
- Edição preserva corretamente a escolha de evento de vários dias.
- Alterar a data de início também redefine a data de término para o mesmo dia.
- Horários programados não aceitam duplicatas.
- Seletores de horário agora usam painel próprio no visual do Tomohu, sem o menu nativo do navegador.

## 0.5.0 — 2026-10-28

### Alterado

- Criação de lembretes agora começa escolhendo claramente entre um dia específico e vários dias.
- Eventos de vários dias aceitam dia todo, evento contínuo ou horários programados diariamente.
- Horários programados podem ser adicionados e removidos livremente; o contador aponta para o próximo horário dentro do período.
- Campos de horário receberam uma apresentação mais integrada ao tema do aplicativo.

## 0.4.0 — 2026-10-28

### Alterado

- Lembretes agora podem durar um dia ou vários dias, com data e horário de início e término quando necessário.
- O contador escolhe automaticamente a leitura mais útil: dias/horas, horas/minutos ou minutos/segundos.
- Lembretes próximos aparecem antes dos mais distantes; eventos em andamento vêm antes dos encerrados.
- Cartões e controles de calendário receberam tipografia maior e contraste mais claro.

## 0.3.0 — 2026-10-28

### Alterado

- Lembretes agora usam calendário próprio, centralizado e integrado ao visual do Tomohu.
- Eventos podem ser marcados como dia todo ou configurados com horário de início e fim.
- Cartões de lembrete mostram um contador até o evento, com formato automático ou escolhido pelo usuário.
- Dados de lembretes antigos continuam funcionando após a atualização.

## 0.2.0 — 2026-10-27

### Alterado

- Checkboxes de listas agora usam o visual da paleta do Tomohu, com estado concluído mais claro.
- Ordenação ganhou controles próprios para Recentes e A–Z, sem o seletor padrão do navegador.
- Seções e subseções aceitam qualquer cor pelo seletor cromático, além das cores sugeridas.
- Botões e navegação entre seções receberam transições leves em navegadores compatíveis.

## 0.1.1 — 2026-10-26

### Alterado

- Removida a barra lateral; navegação inferior compacta com Início e Ajustes.
- Título principal da página inicial simplificado para Lembretes.
- Removidos slogans, mensagens decorativas, rodapé, avatar e cabeçalho redundante.
- Lembretes mostram apenas a data e o conteúdo; sem cartão de exemplo quando não há registros.
- Exportação e número da versão ficam em Ajustes.
- Conteúdo ocupa a largura central, sem coluna reservada à navegação.
- Mantidos os dados existentes e as funcionalidades da versão anterior.

## 0.1.0 — 2026-10-26

Primeira versão funcional para validação local, ainda sem commit ou tag.

### Adicionado

- Interface responsiva azul-escura com lembretes em cartões de papel.
- Página inicial com pesquisa de seções e ordenação por nome ou criação.
- Criação e edição de seções/subseções, com nome, emoji e cor.
- Menu de três pontinhos para configurar seções existentes.
- Navegação por endereço e caminho de seções; suporte ao botão voltar do navegador.
- Criação de notas, checklists, tutoriais e contadores.
- Página própria para editar e interagir com cada conteúdo.
- Listas com conclusão, edição, adição, exclusão e reordenação de itens.
- Contadores com ações rápidas e histórico de data/hora e anotação opcional.
- Lembretes com data/horário, edição e conclusão.
- Salvamento local, aviso em caso de erro e exportação JSON.
- Tipos discriminados, componentes separados e testes de regras de domínio.

### Próximas etapas previstas

- Recuperação de exclusões e organização entre seções.
- Importação de cópias e melhoria das ferramentas de organização.
- Datas recorrentes, login, sincronização e acesso offline completo.
