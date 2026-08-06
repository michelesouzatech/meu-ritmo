# 📱 Meu Ritmo — Plano do MVP
> Um planner pessoal que junta tarefas, hábitos com metas por período e treino num só lugar, com insights sobre sua rotina.

**Status: no ar em https://meu-ritmo.vercel.app** — o MVP inteiro está pronto e em uso. Agora rodando uma [rodada de 5 melhorias](#6-rodada-de-melhorias): 3 entregues, 2 pela frente.

## 1. Decisões

| Tema | Decisão |
|---|---|
| Quem usa | Só a Michele, uso pessoal |
| Login | E-mail e senha via Supabase Auth (com "Esqueci minha senha"). A conexão com o Google Agenda é separada do login — liga a conta Google depois de já estar logada |
| Dispositivo | Mobile-first (uso principal no celular, mas funciona no computador também) |
| Dados | Começa salvando no navegador (localStorage); banco de dados de verdade (Supabase) entra na fase final |
| Identidade visual | Inspiração Barbie, mas **com papel definido por cor**: o rosa (`#E0218A` principal, `#B0116A` profundo, `#FFD9EC` claro) só marca **ação principal, estado ativo e aviso**; o lilás (`#F4EBFF` claro, `#6B4FA0` tinta) marca **informação secundária** — selos, contadores, links, aba ativa; e neutros quentes (`#7D6D79` texto secundário, `#EBE1EA` bordas) cuidam de **texto e divisórias**, que antes eram rosa. Fundo `#FDF8FC`, texto `#241220`, fonte Poppins. O material padrão de toda superfície é o **"vidro líquido"** — painel **fosco e leitoso** (branco de 62% a 84%, desfoque de 26px a 44px), com brilho na borda de cima e reflexo suave embaixo — em três níveis de profundidade, sobre manchas de cor que derivam devagar no fundo. O botão de ação principal também é vidro, tingido de rosa bem claro, com o texto em rosa profundo |
| Referência de layout | Prints de planners com cards arredondados, calendário em destaque, navegação inferior com botão de ação flutuante |

## 2. Telas do app

| Tela | O que a pessoa faz nela |
|---|---|
| Início (Hoje) | Vê um resumo do dia curto e priorizado (tarefa mais urgente, hábitos pendentes com nome encurtado, contagem regressiva da próxima prova de corrida, meta de corrida da semana, avisos da agenda de hoje/amanhã), o anel de progresso dos hábitos do dia, a agenda do Google e as tarefas pendentes |
| Tarefas | Adiciona, edita, marca como feita, marca como urgente, exclui (arrastando o card), vê pendentes e concluídas separadas |
| Hábitos | Cria hábito diário (sem prazo, com sequência de dias) ou com ciclo por período (escolhendo a data de início); edita, marca o progresso por um calendário/seletor de data, reordena a lista por arrastar e reinicia um novo ciclo quando termina |
| Treino | Três sub-abas: **Força** — sobe o PDF do treino (lido e organizado automaticamente por ficha/grupo, com revisão antes de salvar) ou cadastra manualmente; cada ficha abre como **menu suspenso** e os exercícios dentro dela podem ser **reordenados por arrastar (drag-and-drop)**; registra carga por exercício com histórico e painel geral; cadastra % de gordura mês a mês. **Corrida** — cadastra provas (data, local, distância, categoria, pace meta e, depois, tempo oficial e colocação), mantém um plano de treino com meta semanal e acompanha a consistência do mês. **Diário** — registra num calendário do mês o que treinou em cada dia (um registro por treino) e como se sentiu, em cinco carinhas |
| Perfil | Foto (upload), nome, estatísticas rápidas, sair da conta — e embute a tela de **Insights** logo abaixo |
| Insights | Cruza tarefas + hábitos + treino + agenda: resumo da semana, o que está evoluindo, onde melhorar, sugestões práticas. Acessível dentro do Perfil (toque no avatar) |

## 3. O diferencial (detalhado)

**Tarefas + Hábitos com metas por período:** ao invés de hábitos genéricos e infinitos, cada hábito tem um período definido (ex: "durante 15 dias, alimentação 100% limpa"). O app mostra quantos dias já foram cumpridos, quantos faltam, e reseta ou permite criar um novo ciclo quando o período termina.

**Treino inteligente:** a pessoa sobe um PDF do treino que o personal passou, e o app lê o texto automaticamente e organiza os exercícios por grupo/dia (dá pra revisar e ajustar antes de salvar); fotos ficam só como referência visual, com cadastro manual. Cada ficha (grupo/dia) aparece como um **menu suspenso** — fechado por padrão, toca pra abrir — e dentro dela os exercícios podem ser **arrastados (drag-and-drop)** pra reordenar do jeito que a pessoa treina. Cada exercício tem nome, séries x reps e um histórico de carga por data — dá pra ver a evolução de todos os exercícios de uma vez num painel de histórico. O app avisa quando já se passaram 3 meses desde o cadastro do treino atual, sugerindo a hora de pedir um novo (e um novo PDF importado substitui o treino atual). Também é possível cadastrar o % de gordura mês a mês para acompanhar a evolução corporal.

**Corrida com prova como norte:** em vez de só contar quilômetros soltos, a corrida gira em torno da prova que está marcada. A pessoa cadastra a prova (data, local, distância, categoria inscrita, pace meta), monta um ciclo de treinos com meta semanal vinculado a ela, e o app faz duas contas que ninguém quer fazer no papel: o **pace de cada corrida** (sai da distância e do tempo, comparado com a meta na hora) e a **consistência do mês** — proporcional aos dias em que o plano de fato esteve valendo, e no mês corrente contada só até hoje, pra não parecer atrasada todo dia 1º. Depois da prova, entra o tempo oficial (que vira pace) e a colocação geral e na categoria.

**Insights com sugestões:** cruzando os dados de tarefas, hábitos e treino, o app gera um resumo do período mostrando o que está evoluindo (ex: "carga do supino subiu 3 semanas seguidas"), onde a pessoa pode melhorar (ex: "hábito de água caiu nos últimos 4 dias") e sugestões práticas de ajuste (ex: "reduza a meta de água essa semana e retome o ritmo").

## 4. O que o app guarda

```
Tarefa: título, data, status (pendente/feita), observação
Hábito: nome, meta, período (data início, data fim ou nº de dias), progresso diário (feito/não feito por dia)
Treino: nome do exercício, grupo/dia, séries x reps, carga usada (histórico por data), data de cadastro (pra avisar troca a cada 3 meses)
Medição corporal: data, % de gordura
Prova: nome, data, horário, local, distância, categoria inscrita, pace meta,
       tempo oficial, colocação geral, colocação na categoria
Plano de corrida: nome, prova vinculada (opcional), meta semanal, pace meta,
       início e fim, ativo ou arquivado
Corrida: data, plano, distância, tempo, tipo (longão/intervalado/leve)
Diário: data, o que treinou (ficha/corrida/descanso/livre), sensação (1 a 5),
       observação — vários registros por dia, um por treino
Insight: período analisado, resumo gerado, sugestões geradas
```

Pace e tempo são guardados em **segundos** — só assim dá pra comparar "meta 6:00" com "fiz 6:12" e dizer quantos segundos faltaram. A tela converte de e pra `mm:ss`.

Cada tarefa, hábito, treino e corrida pertence só à Michele (login pessoal por e-mail e senha, sem compartilhamento). Todas as 11 tabelas no Supabase têm RLS.

## 5. Fases de construção

- [x] **0. Setup + preview duplo** — Projeto rodando no navegador, mobile-first, com a identidade visual do Meu Ritmo (pink Barbie + Poppins) e uma tela de preview mostrando o app ao mesmo tempo em formato celular e computador.
- [x] **1. Core — Tarefas + Hábitos** — Adicionar/editar/marcar tarefas com aviso de pendência; criar hábitos diários ou com ciclo por período e acompanhar progresso por data. Tudo salvando no navegador.
- [x] **2. Treino** — Upload de PDF do treino com leitura automática por grupo/dia (revisão antes de salvar); foto como referência manual; cadastro e edição direta de exercícios (nome, séries x reps); cada ficha em menu suspenso com exercícios reordenáveis por drag-and-drop; registro de carga por exercício com histórico e painel de histórico geral; cadastro de % de gordura mês a mês; aviso de troca de treino a cada 3 meses (novo PDF substitui o treino atual).
- [x] **3. Insights** — Resumo cruzando tarefas + hábitos + treino, com evolução, pontos de melhoria e sugestões práticas (dentro da tela de Perfil).
- [x] **Final. Publicar** — Login com Google ✅ + foto de perfil ✅ + banco de dados de verdade ✅ (7 tabelas no Supabase, com RLS em todas e a foto do treino no Storage; o que estava salvo no navegador subiu automaticamente na primeira vez) + instalar como app no celular ✅ (PWA com ícone, manifest e service worker) + no ar em **https://meu-ritmo.vercel.app** ✅.
  - Feito no painel do Supabase: `https://meu-ritmo.vercel.app` liberado em Authentication → URL Configuration, então o login com Google volta pro app publicado.
- [x] **Extra. Google Agenda na tela inicial** — Card "Agenda" na tela inicial com a mesma cara da Google Agenda: **grade da semana** com as horas do dia e os compromissos nos seus horários (mais a visão de **mês** no botão ao lado), faixa de "dia todo" no topo e a linha vermelha de agora. As **tarefas do app** aparecem junto, com risquinho quando concluídas — dá pra marcar direto ali. Criar, editar e excluir compromissos direto no app (a alteração vai pro Google na hora); tocar num espaço vazio da grade já abre o formulário naquele horário. O resumo do dia mostra o próximo compromisso junto com tarefas e hábitos, e a agenda entra nos Insights (dia mais cheio, dias livres, choque entre tarefa e compromisso).
  - Mostra **todas as agendas** que estão marcadas na Google Agenda (Estudos, Exercícios, Pets...), cada uma na sua cor — não só a principal.
  - Feito no Google Cloud: **Google Calendar API** ativada e escopos `calendar.events` e `calendar.readonly` liberados em Acesso a dados — passo a passo no [README](README.md).
- [x] **Ajustes de uso no celular** — Corrigido o zoom automático do iPhone ao tocar num campo de texto: o Safari amplia a tela sempre que a fonte do campo é menor que 16px e não desfaz o zoom depois. Os campos passaram a usar 16px em telas de toque (`src/index.css`), o que resolve na origem sem precisar bloquear a pinça pra ampliar.
- [x] **Hábitos: editar, reordenar e escolher início do ciclo** — Cada hábito pode ser editado (nome, ciclo, data de início) por um lápis no card, e a lista pode ser reorganizada por arrastar — mesmo padrão de drag-and-drop já usado nos exercícios do Treino. Ao criar um hábito com ciclo, dá pra escolher a data de início em vez de sempre começar no dia da criação.
- [x] **Home mais enxuta e resumo inteligente do dia** — A lista de hábitos saiu da tela inicial (ficou só na tela de Hábitos); no lugar entrou um anel de progresso mostrando o % concluído no dia. O card "Seu resumo de hoje" virou um resumo curto e priorizado — tarefa mais urgente, hábitos pendentes com nome encurtado (ex: "cardio 30 min" → "cardio", "alimentação 100% limpa" → "alimentação 100%") e avisos sobre compromissos de hoje e de amanhã na agenda — em vez de um texto único e genérico.
- [x] **Login por e-mail e senha** — Troca o login (antes só Google) por e-mail e senha via Supabase Auth, com "Esqueci minha senha" pra quem criou a conta na época do login antigo definir uma senha nova. A conexão com o Google Agenda passou a ser independente do login — dá pra conectar e reconectar sem trocar de sessão.
- [x] **Perfil na barra de navegação** — "Perfil" virou um item fixo do menu inferior, acessível de qualquer tela (antes só abria pelo avatar na Home).
- [x] **Lilás claro + liquid glass** — Terceira cor (lilás bem clarinho, `#F4EBFF`, derivado do mesmo tom do pink claro só girando o matiz) marcando informação secundária: selo de status do hábito, contador de exercícios da ficha de treino e a aba ativa da navegação. Essas superfícies, mais o card de resumo do dia e o anel de progresso, ganharam o material "vidro líquido" — painel translúcido, desfoque de fundo, um fio de luz na borda — sobre manchas suaves de cor adicionadas ao fundo do app pra dar profundidade ao desfoque.
- [x] **Card de hábito mais enxuto + ciclo futuro corrigido** — Os ícones de editar e excluir saíram de uma linha inteira no rodapé do card e passaram pra logo abaixo do selo de status, deixando o card mais compacto. Hábito de ciclo com data de início no futuro não conta mais o dia da criação como "dia 1": mostra o selo "em breve" e só começa a contar a partir da data de início escolhida.

> Daqui pra frente, o trabalho está na [rodada de melhorias](#6-rodada-de-melhorias) abaixo.
## 6. Rodada de melhorias

Cinco melhorias definidas depois do MVP no ar, feitas uma por vez. A ordem foi trocada de propósito: o visual veio primeiro pra as telas novas já nascerem no material certo, em vez de serem refeitas depois.

- [x] **1. Menos rosa, mais vidro líquido** *(era a melhoria 2, antecipada)* — O rosa deixou de ser a cor de tudo e virou a cor de três papéis: ação principal, estado ativo e aviso. Título de card virou tinta neutra, borda de campo virou linha neutra (rosa só no foco), selo e link secundário viraram lilás — de **251 usos de rosa pra 76**, e de **4 usos de lilás pra 72**. O branco chapado dos **28 cards virou vidro**: `src/index.css` ganhou três níveis de profundidade (`.ritmo-card` padrão, `.ritmo-glass` elevado, `.ritmo-inset` pro que fica dentro de outro vidro — sem desfoque próprio, porque desfoque empilhado engasga a rolagem em celular antigo), mais `.ritmo-field`, `.ritmo-cta` e `.ritmo-ghost`, o que tirou strings de 12 classes repetidas de 20 campos e 8 botões. O fundo passou de 3 pra 5 manchas com deriva lenta (respeitando `prefers-reduced-motion`), com o desfoque no contêiner pra o navegador desfocar uma vez só. A escala do calendário de hábitos foi de rosa→rosa pra **lilás→rosa**, com o começo mais escuro porque o número branco sumia no rosa claro.
- [x] **2. Corrida na tela de Treino** *(era a melhoria 1)* — Treino virou duas sub-abas (**Força | Corrida**), lembrando a última usada. **Provas:** nome, data, horário, local, distância, categoria inscrita e pace meta; depois da prova, tempo oficial (o app calcula o pace) e colocação geral e na categoria. Card da próxima prova com contagem regressiva e botão opcional pra criar o compromisso na Google Agenda — só quando ela pede, guardando o id pra não duplicar. **Plano de treino:** um ativo por vez, com meta semanal, vínculo opcional com a prova (herdando o pace meta dela) e faixa da semana pra dar check; tocar num dia passado já abre o registro naquela data. **Consistência:** % do mês contra a meta, proporcional aos dias em que o plano esteve valendo e, no mês corrente, contada só até hoje. **Corridas:** distância e tempo, com o pace calculado ao vivo enquanto digita, e rótulo de tipo opcional (longão, intervalado, leve). A tela inicial ganhou duas linhas no resumo do dia: contagem pra prova e meta da semana (que só cobra a partir de quinta). Corrida registrada sem plano ativo continua salva — só não entra na consistência.
  - Feito no Supabase: 3 tabelas novas (`races`, `run_plans`, `run_sessions`) com RLS igual às outras.
  - `src/lib/pace.js` e `src/lib/running.js` concentram as contas, cobertas por 33 testes (conversão de tempo, pace, meta proporcional do mês).
  - A tela de Treino foi dividida: `WorkoutScreen.jsx` virou a casca com as sub-abas, `GymTab.jsx` ficou com o conteúdo antigo e `RunningTab.jsx` com o novo.
- [ ] **3. Insights por aba** — Hoje os insights são uma tela só, dentro do Perfil. Passam a aparecer também em cada aba, com o recorte dela: só hábitos em Hábitos, só carga e % de gordura em Força, só consistência e pace em Corrida, só conclusão de tarefas em Tarefas. O Perfil segue com o geral, somando tudo. `src/lib/insights.js` já é separado por domínio por dentro, então é mais reorganização que reescrita — o que falta escrever do zero são os insights de corrida e os de tarefas, que hoje têm só uma sugestão.
- [x] **4. Diário de treino** — Terceira sub-aba em Treino. **Um registro por treino, vários por dia**: superiores de manhã e corrida à noite viram duas linhas do mesmo dia, cada uma com sua sensação — porque são duas coisas diferentes de sentir. Cada registro tem o que foi feito (uma ficha do treino cadastrado, corrida, descanso ou atividade livre como pilates), a sensação em **cinco carinhas** (😫 acabada → 🤩 ótima) e uma observação. A aba abre num **calendário do mês** que mostra uma carinha em cada dia — a média do dia quando teve mais de um treino — e tocar num dia lista os registros dele embaixo. Atividade livre já usada volta como sugestão.
  - **Sem vínculo com a aba Corrida, de propósito.** A aba Corrida mede desempenho (pace, consistência); o diário mede como o corpo respondeu. Registrar corrida no diário não dá check no plano de treino, e vice-versa.
  - Feito no Supabase: tabela `workout_journal` com RLS, mais travas que recusam sensação fora de 1–5 e tipo de atividade inválido.
  - As contas ficam em `src/lib/journal.js`, cobertas por 22 testes.
- [x] **Ajuste de material: vidro mais fosco e rosa mais claro** — Depois de ver a fase 4 pronta, três acertos. **"Musculação" virou "Força"**, o que de quebra resolveu o aperto das três sub-abas na largura do celular. **O vidro ficou bem mais leitoso**: o branco subiu de 62% pra 84% no nível elevado e o desfoque quase dobrou (16px → 44px), com brilho na borda de cima e reflexo embaixo pra dar espessura. Como painel fosco precisa de cor por baixo pra não virar cinza, as manchas do fundo subiram junto (de ~0,22 pra ~0,34 de opacidade). **O gradiente rosa clareou** — e isso mudou a forma do botão, não só a cor: rosa claro não sustenta texto branco (daria 1,44:1 de contraste), então o botão principal virou vidro tingido com texto em rosa profundo, dando 4,67 a 5,48:1 nas duas pontas do gradiente.
  - Descoberto na conferência: o botão **antigo já estava abaixo do mínimo** de 4,5:1 (branco sobre `#E0218A` dá 4,42:1). O ajuste corrigiu isso de tabela.
  - Em aberto: os indicadores de estado sólidos (bolinha do dia que correu, check de tarefa, dia selecionado na agenda) continuam em rosa forte, porque não são gradiente. Se destoarem do resto mais claro no uso, clareiam também.
- [ ] **5. Notificações na tela do app** — Central de avisos dentro do app, montada a partir dos dados que já existem (tarefa urgente, hábito pendente, treino com 3 meses, prova chegando, faz N dias que não corre). Notificação push de verdade, com o app fechado, continua na [Versão 2](#7-versão-2-fica-pra-depois) — precisa de servidor.

## 7. Versão 2 (fica pra depois)

- Compromissos que se repetem (criar recorrência pelo app; hoje dá pra editar só o dia)
- Convidar gente para um compromisso e ver quem confirmou
- Manter a conexão da agenda ativa sozinha por mais de 1 hora (precisa de um pedacinho de servidor pra renovar o token)
- Notificações push (fora do app, no estilo celular)
- Insights mais avançados/preditivos com IA
