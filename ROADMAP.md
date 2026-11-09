# Roadmap do Tomohu

Este arquivo é o organizador geral do projeto. Antes de começar uma funcionalidade, ela deve entrar aqui; depois de entregue, recebe uma versão e muda para **Concluído**.

## Como organizamos as entregas

| Tipo                     | Quando usar                                                         | Exemplo                                              |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------- |
| **Mini patch** (`x.y.1`) | Correção ou pequeno ajuste visual, sem mudar uma função importante. | Trocar o seletor de ordenação por um único dropdown. |
| **Update** (`x.y.0`)     | Uma função nova ou evolução relevante de algo existente.            | Melhorar lembretes com calendário e horários.        |
| **Marco** (`x.0.0`)      | Base madura do app ou uma mudança grande de arquitetura.            | Dados em nuvem, contas de usuário e versão estável.  |

Uma entrega pode ter vários commits. A versão só sobe quando a função estiver testada e pronta para uso.

## Current delivery sequence

- [x] `0.18.0` — Backend accounts: registration, login, short-lived bearer tokens, notebook ownership, migrations, and authorization tests. Frontend account integration is a later delivery.
- [x] `0.19.0` — Refactor the frontend by feature, with component and browser regression coverage established before extraction. Preserve current behavior and local data.
- [x] `0.19.0` review fixes — Resume autosave after confirmed recovery, normalize reminder times, reject invalid counter timestamps, and keep mobile tag controls visible.
- [ ] `0.20.0` (planned) — Integrate authenticated accounts and safe synchronization after the frontend refactor; define migration, backup, and conflict-resolution behavior first.

**0.18 validation:** local release checks completed, including 56 tests on native PostgreSQL 17 and manual API ownership/persistence checks. See `docs/versions/0.18.0.md` for the evidence and remaining production limits. Remote CI and PR review must still pass before integration.

Each substantial architecture change receives its own minor release and reviewable baseline. Never combine frontend restructuring and synchronization in one release.

## Earlier deliveries

### `0.3.0` · Lembretes e eventos

- [x] Calendário próprio, centralizado e no estilo do Tomohu. — `0.3.0`
- [x] Separar claramente o botão **Hoje** da ação de salvar o lembrete. — `0.3.0`
- [x] Evento de dia inteiro ou evento com intervalo de início e fim. — `0.3.0`
- [x] Contador até o evento, com formatos adequados ao tempo restante. — `0.3.0`
- [x] Base preparada para notificações futuras. — `0.3.0`

### `0.4.0` · Duração e prioridade de eventos

- [x] Eventos de um dia ou de vários dias, com início e término independentes. — `0.4.0`
- [x] Eventos de vários dias também podem ser configurados como dia todo. — `0.4.0`
- [x] Contador automático, com leitura adaptada ao tempo restante. — `0.4.0`
- [x] Lembretes ordenados pelo evento mais próximo; eventos encerrados ficam por último. — `0.4.0`
- [x] Tipografia de lembretes e calendário mais legível. — `0.4.0`

### `0.5.0` · Eventos recorrentes por período

- [x] Fluxo de criação que explica primeiro se o evento acontece em um dia ou vários. — `0.5.0`
- [x] Horários programados diariamente dentro de um período, com quantidade livre de horários. — `0.5.0`
- [x] Opção clara de evento contínuo para início e término únicos. — `0.5.0`
- [x] Contador direcionado ao próximo horário programado. — `0.5.0`
- [x] Ajustes de clareza, edição e seleção de horários. — `0.5.1`
- [x] Regra visual e técnica para horários programados únicos. — `0.5.2`
- [x] Alerta contextual de horário repetido e painéis sem rolagem lateral. — `0.5.3`
- [x] Decisão para lembretes encerrados e avisos claros de validação. — `0.5.4`
- [x] Lembrete pontual em dia específico, com um único horário. — `0.5.5`

## Mini patches planejados

- [x] Melhorar a leitura de números e textos do calendário no tema claro. — `0.14.2`
- [x] Corrigir contraste, seletor de cores e campo de tags no tema claro. — `0.14.1`
- [x] Organizar listas expansíveis em colunas independentes e permitir excluir conteúdos com confirmação. — `0.11.4`
- [x] Corrigir o espaço visual ao expandir listas e permitir excluir uma seção com confirmação, incluindo suas subseções e conteúdos. — `0.11.3`
- [x] Trocar os controles atuais de ordenação por um único botão dropdown, com filtro pelas cores já usadas e ordem por recentes, antigas ou A–Z. — `0.6.2`
- [x] Melhorar fluidez ao entrar em sessões, abrir conteúdos e executar ações. — `0.7.0`
- [ ] Pequenos ajustes de acessibilidade, textos, espaçamentos e responsividade que surgirem nos testes.

## Updates planejadas

### Experiência visual e fluidez

- [x] Criar um sistema leve e consistente de animações para o Tomohu, sem aumentar o peso do app. — `0.7.0`
- [x] Animar a entrada de menus, modais, calendários e seletores com transições curtas e suaves. — `0.7.0`
- [x] Dar retorno visual sutil ao tocar em cartões, botões e ações concluídas. — `0.7.0`
- [x] Aplicar animação de aparecimento aos menus de ações de lembretes, como alterar ou excluir, inspirada na sensação fluida de calendários modernos. — `0.7.0`
- [x] Respeitar a preferência do dispositivo por reduzir animações (`prefers-reduced-motion`). — `0.7.0`
- [x] Redesenhar os cartões de lembrete: formato quase quadrado, levemente vertical, com variações de papel, fita, clipe, espiral e bordas rasgadas sutis. — `0.10.2`

### Organização e uso diário

- [x] Progresso visual em listas e coleções: quantidade, porcentagem e barra de avanço. — `0.8.0`
- [x] Cartões de checklist e tutorial recolhíveis dentro da seção: começam compactos, expandem ao clicar para mostrar os itens e recolhem novamente, com animações curtas e fluidas. — `0.11.0`
- [x] Favoritar/fixar seções importantes no topo. — `0.9.0`
- [x] Busca global por seções, conteúdos, notas, itens de lista e lembretes, com abertura direta do resultado. — `0.12.0`
- [x] Tags para organizar seções por assunto, com filtro e busca global. — `0.13.0`
- [ ] Filtros adicionais por tipo de conteúdo e estado de conclusão, quando esses dados fizerem sentido para a tela.
- [ ] Arquivar sessões e conteúdos concluídos sem apagar.
- [ ] Repetição de eventos: diária, semanal, mensal e personalizada.
- [ ] Tipo de conteúdo de coleção/tracker, útil para coisas como times Pokémon.

### Personalização

- [ ] Transformar **Ajustes** em uma página de **Configurações**, preparada para centralizar preferências do app e, no futuro, o gerenciamento da conta do usuário.
- [x] Checkboxes estilizadas com a paleta do app. — `0.2.0`
- [x] Cores livres para seções e subseções. — `0.2.0`
- [x] Tema claro e escuro, salvo na preferência do navegador. — `0.14.0`
- [ ] Seletor de idioma do app, começando por português e inglês, com textos centralizados para facilitar novos idiomas.
- [x] Escolha de formato de hora: 24 horas ou 12 horas (AM/PM), salva nas preferências do app. — `0.15.0`
- [ ] Estilos de fonte predefinidos, como Padrão, Leitura e Nota, aplicados ao app inteiro e salvos na preferência do usuário.
- [ ] Mais opções de personalização visual sem perder a identidade do Tomohu.

### Dados, backup e dispositivos

- [x] Criar a base do backend em Python/FastAPI, com configuração por ambiente, CORS restrito, rota de saúde e testes independentes do front-end. — `0.16.0`
- [x] Definir a persistência do backend: PostgreSQL local e preparado para Supabase, SQLAlchemy, migrations, contratos validados e API de snapshot com proteção contra sobrescrita concorrente. — `0.17.0`
- [x] Importar backup JSON pela interface, com validação e confirmação antes de substituir os dados atuais. — `0.6.0`
- [ ] Passar o projeto para uma **PWA** instalável: abrir como app no PC/celular e ter suporte offline onde for possível.
- [x] Definir corretamente a estratégia de armazenamento e o banco de dados antes de dados sensíveis ou contas. — `0.17.0`

### Contas, privacidade e segurança

- [x] Backend account registration, login, and owner-scoped notebook access. — `0.18.0`
- [ ] Frontend login and account lifecycle interface; planned after `0.19.0`.
- [ ] Onboarding após criar a conta: escolher idioma, tema claro/escuro padrão, formato de hora (12/24h) e outras preferências de qualidade de vida, todas alteráveis depois em Configurações.
- [x] Backend notebook ownership and access isolation. — `0.18.0`
- [ ] Account-based browser data migration, synchronization, and backups.
- [ ] Sessões privadas protegidas por senha.
- [ ] Criptografia real para conteúdo privado e proteção adequada de dados sensíveis.
- [ ] Notificações e alarmes de eventos, configuráveis como em calendários.
- [ ] Lembrete flash: criação instantânea com apenas um campo de texto; ao adicionar, já começa a avisar a cada 10 minutos por padrão. Configurações como intervalo, notificação/alarme, concluir e adiar ficam opcionais, disponíveis somente para quem quiser detalhar.

## Visão de marco

- [ ] `1.0.0`: Tomohu estável, instalável, com backup/importação confiáveis e uma base de organização madura.
- [ ] Depois da base estável: sincronização por conta, privacidade avançada e notificações completas.

## Saúde do código — regra principal

Qualidade de vida do código vem antes de velocidade de entrega.

## Experiência do usuário — regra permanente

Toda função nova deve ser analisada pelo ponto de vista de quem está usando o Tomohu pela primeira vez. Se houver chance de dúvida, erro comum ou trabalho desnecessário, a própria interface deve prevenir ou explicar: escolhas com nomes claros, passos guiados, valores padrão seguros e avisos contextuais em vermelho quando uma ação não puder continuar. A meta não é apenas adicionar recursos, mas tornar cada recurso fácil de entender sem depender de manual.

- Fazer **uma funcionalidade principal por update**; não juntar várias mudanças grandes na mesma entrega.
- Antes de modificar, entender onde a função atual está ligada. Ao remover algo, remover também dependências e código morto.
- Preservar dados existentes: mudanças no formato salvo precisam manter compatibilidade ou ter migração.
- Evitar atalhos que deixem partes do app dependentes de um componente que pode sumir sem substituição.
- Rodar `lint`, formatação, testes e build antes de cada entrega.
- Testar manualmente os fluxos afetados no navegador, inclusive criar, editar, salvar, recarregar e excluir quando aplicável.
- Fazer commits pequenos e descritivos; uma atualização pode conter vários commits saudáveis.
- Se uma ideia exigir backend, autenticação ou segurança, planejar primeiro em vez de improvisar no front-end.
