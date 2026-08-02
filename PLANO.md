# 📱 Meu Ritmo — Plano do MVP
> Um planner pessoal que junta tarefas, hábitos com metas por período e treino num só lugar, com insights sobre sua rotina.

**Status: MVP pronto e no ar em https://meu-ritmo.vercel.app** — todas as fases do plano foram concluídas. O que sobrar daqui pra frente é ajuste de uso e os itens da [Versão 2](#6-versão-2-fica-pra-depois).

## 1. Decisões

| Tema | Decisão |
|---|---|
| Quem usa | Só a Michele, uso pessoal |
| Login | Sim, com Google — entra só na fase final |
| Dispositivo | Mobile-first (uso principal no celular, mas funciona no computador também) |
| Dados | Começa salvando no navegador (localStorage); banco de dados de verdade (Supabase) entra na fase final |
| Identidade visual | Pink puro, inspiração Barbie — pink `#E0218A` (principal), pink profundo `#B0116A` (contraste/gradiente), pink suave `#FFD9EC` (fundos de destaque) + fundo `#FFF7FB` + texto `#241220`. Fonte: Poppins |
| Referência de layout | Prints de planners com cards arredondados, calendário em destaque, navegação inferior com botão de ação flutuante |

## 2. Telas do app

| Tela | O que a pessoa faz nela |
|---|---|
| Início (Hoje) | Vê um resumo do dia curto e priorizado (tarefa mais urgente, hábitos pendentes com nome encurtado, avisos da agenda de hoje/amanhã), o anel de progresso dos hábitos do dia, a agenda do Google e as tarefas pendentes |
| Tarefas | Adiciona, edita, marca como feita, marca como urgente, exclui (arrastando o card), vê pendentes e concluídas separadas |
| Hábitos | Cria hábito diário (sem prazo, com sequência de dias) ou com ciclo por período (escolhendo a data de início); edita, marca o progresso por um calendário/seletor de data, reordena a lista por arrastar e reinicia um novo ciclo quando termina |
| Treino | Sobe o PDF do treino (lido e organizado automaticamente por ficha/grupo, com revisão antes de salvar) ou cadastra manualmente; cada ficha abre como **menu suspenso** e os exercícios dentro dela podem ser **reordenados por arrastar (drag-and-drop)**; registra carga por exercício com histórico e painel geral; cadastra % de gordura mês a mês |
| Perfil | Foto (upload), nome, estatísticas rápidas, sair da conta — e embute a tela de **Insights** logo abaixo |
| Insights | Cruza tarefas + hábitos + treino + agenda: resumo da semana, o que está evoluindo, onde melhorar, sugestões práticas. Acessível dentro do Perfil (toque no avatar) |

## 3. O diferencial (detalhado)

**Tarefas + Hábitos com metas por período:** ao invés de hábitos genéricos e infinitos, cada hábito tem um período definido (ex: "durante 15 dias, alimentação 100% limpa"). O app mostra quantos dias já foram cumpridos, quantos faltam, e reseta ou permite criar um novo ciclo quando o período termina.

**Treino inteligente:** a pessoa sobe um PDF do treino que o personal passou, e o app lê o texto automaticamente e organiza os exercícios por grupo/dia (dá pra revisar e ajustar antes de salvar); fotos ficam só como referência visual, com cadastro manual. Cada ficha (grupo/dia) aparece como um **menu suspenso** — fechado por padrão, toca pra abrir — e dentro dela os exercícios podem ser **arrastados (drag-and-drop)** pra reordenar do jeito que a pessoa treina. Cada exercício tem nome, séries x reps e um histórico de carga por data — dá pra ver a evolução de todos os exercícios de uma vez num painel de histórico. O app avisa quando já se passaram 3 meses desde o cadastro do treino atual, sugerindo a hora de pedir um novo (e um novo PDF importado substitui o treino atual). Também é possível cadastrar o % de gordura mês a mês para acompanhar a evolução corporal.

**Insights com sugestões:** cruzando os dados de tarefas, hábitos e treino, o app gera um resumo do período mostrando o que está evoluindo (ex: "carga do supino subiu 3 semanas seguidas"), onde a pessoa pode melhorar (ex: "hábito de água caiu nos últimos 4 dias") e sugestões práticas de ajuste (ex: "reduza a meta de água essa semana e retome o ritmo").

## 4. O que o app guarda

```
Tarefa: título, data, status (pendente/feita), observação
Hábito: nome, meta, período (data início, data fim ou nº de dias), progresso diário (feito/não feito por dia)
Treino: nome do exercício, grupo/dia, séries x reps, carga usada (histórico por data), data de cadastro (pra avisar troca a cada 3 meses)
Medição corporal: data, % de gordura
Insight: período analisado, resumo gerado, sugestões geradas
```

Cada tarefa, hábito e treino pertence só à Michele (login pessoal via Google, sem compartilhamento).

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

## 6. Versão 2 (fica pra depois)

- Compromissos que se repetem (criar recorrência pelo app; hoje dá pra editar só o dia)
- Convidar gente para um compromisso e ver quem confirmou
- Manter a conexão da agenda ativa sozinha por mais de 1 hora (precisa de um pedacinho de servidor pra renovar o token)
- Notificações push (fora do app, no estilo celular)
- Insights mais avançados/preditivos com IA
