# 🧡 Meu Ritmo — Prompts prontos pra construir cada fase

Cole cada prompt no Claude, um de cada vez, na ordem. Só avance pra próxima fase quando a anterior estiver funcionando e aprovada.

---

## Prompt — Fase 0: Setup + preview duplo

Leia o arquivo PLANO.md. Estou construindo o app Meu Ritmo: um planner pessoal que junta tarefas, hábitos com metas por período e treino num só lugar, com insights sobre minha rotina.

Vamos construir SÓ a Fase 0: o setup do projeto e a identidade visual.

Nesta fase:
- Cria o projeto (mobile-first, funciona bem no navegador).
- Aplica a identidade visual: pink puro inspirado na Barbie — `#E0218A` como cor principal, `#B0116A` para contraste/gradiente, `#FFD9EC` para fundos de destaque, fundo `#FFF7FB`, texto `#241220`, fonte Poppins.
- Cria uma tela inicial simples só pra mostrar a cara do app (pode ser um "Olá, bem-vindo ao Meu Ritmo" com um cartão de exemplo).
- Cria uma tela de preview (`preview.html`) que mostra o app rodando DUAS vezes ao mesmo tempo, lado a lado: à esquerda dentro de uma moldura de celular (~390px de largura, com aparência de telefone), à direita em largura de computador. As duas telas devem ser dois `<iframe>` apontando para a URL do app rodando localmente (não cópias estáticas nem prints) — ou seja, o app de verdade, clicável, nos dois tamanhos ao mesmo tempo, atualizando sozinho quando eu mudar o código.

Identidade visual: pink puro (inspiração Barbie), fonte Poppins, mobile-first.
Não faça ainda: nenhuma tela de tarefas, hábitos, treino ou insights — isso é da Fase 1 em diante. Não conecte banco de dados nem login.
Vá me explicando o que está fazendo em linguagem simples e me avise quando eu puder testar.

Está pronto quando:
- [ ] Abro o preview e vejo o app rodando nas duas telas (celular e computador) ao mesmo tempo
- [ ] Consigo clicar/interagir nas duas versões
- [ ] A cara do app já está com o pink Barbie e a fonte Poppins
- [ ] Se eu mudar algo no código, as duas telas do preview atualizam sozinhas

---

## Prompt — Fase 1: Core — Tarefas + Hábitos

Leia o arquivo PLANO.md. Estou construindo o app Meu Ritmo: um planner pessoal que junta tarefas, hábitos com metas por período e treino num só lugar, com insights sobre minha rotina.

Já concluí a Fase 0 (setup + identidade visual + preview duplo). Agora vamos construir SÓ a Fase 1: Tarefas + Hábitos.

Nesta fase:
- Tela de Início (Hoje): mostra as tarefas pendentes do dia e os hábitos do dia num resumo.
- Tela de Tarefas: adicionar, editar, marcar como feita, e ver as pendentes com um aviso visual (ex: badge ou cor diferente).
- Tela de Hábitos: criar um hábito com meta e período (ex: "durante 7 dias, beber 2L de água"), marcar o progresso de cada dia, e ver quantos dias já foram cumpridos e quantos faltam.
- Tudo salvando no navegador (localStorage) — nada de banco de dados ainda.

Identidade visual: pink puro (inspiração Barbie), fonte Poppins, mobile-first, seguindo o que já foi definido na Fase 0.
Não faça ainda: treino, insights, banco de dados de verdade, login.
Vá me explicando o que está fazendo em linguagem simples e me avise quando eu puder testar.

Está pronto quando:
- [ ] Consigo adicionar uma tarefa e ela aparece na lista
- [ ] Consigo marcar a tarefa como feita e o status muda
- [ ] Consigo criar um hábito com meta e período, e marcar o progresso do dia
- [ ] Fecho o navegador, abro de novo, e tarefas/hábitos continuam lá
- [ ] A tela de Início mostra o resumo do dia certinho

---

## Prompt — Fase 2: Treino

Leia o arquivo PLANO.md. Estou construindo o app Meu Ritmo. Já concluí as Fases 0 e 1 (setup e Tarefas + Hábitos). Agora vamos construir SÓ a Fase 2: Treino.

Nesta fase:
- Tela de Treino: permite subir uma foto ou PDF do treino, e organizar os exercícios automaticamente em colunas por dia/grupo muscular (pode ser um cadastro manual assistido, se a leitura automática do arquivo for complexa — me avise se for o caso).
- Em cada exercício, dá pra registrar a carga usada em cada sessão, formando um histórico de evolução (ex: gráfico simples ou lista por data).
- Tela ou seção para cadastrar o % de gordura mês a mês, com histórico.
- Um aviso visual quando já se passaram 3 meses desde o cadastro do treino atual, sugerindo a hora de trocar.

Identidade visual: pink puro (inspiração Barbie), fonte Poppins, mobile-first, seguindo o que já foi definido.
Não faça ainda: insights, banco de dados de verdade, login, integração com Google Calendário.
Vá me explicando o que está fazendo em linguagem simples e me avise quando eu puder testar.

Está pronto quando:
- [ ] Consigo cadastrar um treino (por upload ou manualmente) e ele aparece organizado por dia/grupo
- [ ] Consigo registrar a carga usada num exercício e ver o histórico
- [ ] Consigo cadastrar o % de gordura de um mês e ver o histórico
- [ ] Depois de 3 meses (ou simulando a data), aparece o aviso de troca de treino

---

## Prompt — Fase 3: Insights

Leia o arquivo PLANO.md. Estou construindo o app Meu Ritmo. Já concluí as Fases 0, 1 e 2. Agora vamos construir SÓ a Fase 3: Insights.

Nesta fase:
- Tela de Insights: cruza os dados de tarefas, hábitos e treino (incluindo % de gordura) já salvos no navegador.
- Mostra um resumo do período (ex: "essa semana você completou 80% das tarefas").
- Mostra o que está evoluindo (ex: "sua carga no supino subiu 3 semanas seguidas").
- Mostra onde pode melhorar (ex: "o hábito de água caiu nos últimos 4 dias").
- Dá sugestões práticas de ajuste (ex: "reduza a meta de água essa semana e retome o ritmo").

Identidade visual: pink puro (inspiração Barbie), fonte Poppins, mobile-first, seguindo o que já foi definido.
Não faça ainda: banco de dados de verdade, login, integração com Google Calendário, notificações push.
Vá me explicando o que está fazendo em linguagem simples e me avise quando eu puder testar.

Está pronto quando:
- [ ] A tela de Insights mostra um resumo real baseado nos meus dados de tarefas, hábitos e treino
- [ ] Aparece pelo menos uma evolução, um ponto de melhoria e uma sugestão prática
- [ ] Os insights mudam conforme eu uso o app e os dados mudam

---

## Prompt — Fase Final: Publicar

Chegou a hora de tornar o Meu Ritmo permanente e acessível no celular de verdade. Primeiro, vamos usar a skill "vamos construir o back-end do meu app" para conectar o Supabase (banco de dados de verdade) e o login com Google. Depois disso, vamos fazer o deploy (Vercel) e instalar o app no celular como PWA.
