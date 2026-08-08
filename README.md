# Meu Ritmo

Planner pessoal que junta tarefas, hábitos com metas por período e treino num só
lugar, com insights sobre a rotina. Mobile-first.

**No ar:** https://meu-ritmo.vercel.app

## Rodar no computador

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera a versão publicável em dist/
npm run lint
```

O arquivo `.env` (não versionado) precisa de:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Como está montado

- **Front-end:** React + Vite + Tailwind. Telas em [src/screens/](src/screens/).
- **Dados:** Supabase (Postgres). Toda conversa com o banco fica em
  [src/lib/db.js](src/lib/db.js) — o resto do app usa os mesmos formatos de
  sempre.
- **Login:** e-mail e senha, via Supabase Auth. A tela de login tem "Esqueci
  minha senha", que manda um link por e-mail pra definir a senha — é o
  caminho pra quem já tinha conta (criada antes, pelo login com Google)
  passar a entrar com senha.
- **Google Agenda:** ver, criar, editar e apagar compromissos
  (`calendar.events`), direto da tela inicial, numa grade de semana/mês que
  mostra também as tarefas do app —
  [src/components/AgendaCard.jsx](src/components/AgendaCard.jsx) desenha e
  [src/lib/weekGrid.js](src/lib/weekGrid.js) calcula a posição dos blocos. É
  uma conexão à parte do login: a pessoa clica em "Conectar Google Agenda" e o
  token do Google fica guardado no navegador —
  [src/lib/googleCalendar.js](src/lib/googleCalendar.js) e
  [src/hooks/useGoogleCalendar.js](src/hooks/useGoogleCalendar.js). Essa
  conexão usa `supabase.auth.signInWithOAuth` de novo — como a conta já tem a
  identidade Google ligada desde a época do login por Google, o Supabase
  sempre reautentica essa mesma conta. Como esse token vale 1 hora e não é
  renovado sozinho, a tela inicial mostra o botão "Reconectar Google Agenda"
  quando ele vence.
- **Arquivos:** foto de perfil no bucket `avatars`, foto/PDF do treino no bucket
  `treinos` (privado, aberto por link temporário).
- **Segurança:** RLS ligado nas 7 tabelas — cada conta só enxerga e mexe nos
  próprios dados.

### Tabelas

`tasks`, `habits`, `habit_completions`, `workouts`, `exercises`, `carga_logs`,
`body_fat`. (A agenda não é salva no banco — é lida direto do Google a cada
abertura.)

## Insights

Dois motores, em camadas.

O de baixo é determinístico: [src/lib/insights.js](src/lib/insights.js) cruza os
registros e escreve as frases das abas e o parágrafo do Perfil. Roda a cada
marcação, não custa nada e funciona sem internet — é o piso.

Por cima entra o Gemini, uma vez por dia. Ele recebe o resumo agregado **mais o
que as regras já disseram**, justamente pra não repetir o que está na tela logo
abaixo, e devolve as leituras que cruzam áreas que nenhuma regra cruza. Se a
cota acabar ou a rede cair, as telas continuam com o motor de baixo.

- **É uma chamada só pro app inteiro**, não uma por aba
  ([src/hooks/useAiInsights.js](src/hooks/useAiInsights.js) chama e distribui).
  Cinco requisições gastariam cinco vezes a cota pra entregar uma leitura pior,
  cada pedaço cego sobre o resto.
- **A chave nunca vai pro navegador.** Qualquer `VITE_*` vira texto visível no
  site publicado, então a chamada passa pela Edge Function
  [supabase/functions/insights-ia/index.ts](supabase/functions/insights-ia/index.ts),
  onde a chave mora como segredo.
- **O que sai do aparelho está todo em**
  [src/lib/aiSummary.js](src/lib/aiSummary.js) — é a fronteira de privacidade.
  Hoje vão os nomes (hábito, exercício, prova), as notas do diário e os
  compromissos da agenda; e-mail e ids nunca vão. Pra cortar um campo, basta
  parar de preenchê-lo lá.
- **Uma geração por dia**, guardada no navegador por conta. O que muda ao longo
  do dia continua aparecendo pelo motor de regras.

### Publicar a função (uma vez, e a cada mudança nela)

```bash
npx supabase login
npx supabase link --project-ref xezuovgvzdqmuvvsqjnv
npx supabase secrets set GEMINI_API_KEY=...      # chave do Google AI Studio
npx supabase functions deploy insights-ia
```

### A chave do Gemini

Este app tem chave própria, separada da de qualquer outro projeto. O motivo é
cota: quando ela acaba, a função responde 429 e o app mostra "a cota gratuita do
Gemini de hoje acabou" — e um app não pode derrubar o outro por ter gerado
análise demais.

Só que a cota não é contada por chave, e sim pelo **projeto do Google Cloud** a
que a chave pertence. Duas chaves no mesmo projeto continuam dividindo o mesmo
limite. Então, ao criar a chave no [Google AI Studio](https://aistudio.google.com/apikey):

1. **Criar chave de API** → na hora de escolher o projeto, criar um **projeto
   novo** (algo como `meu-ritmo-ia`) em vez de reaproveitar um existente.
2. Guardar a chave — ela só aparece por inteiro nesse momento.
3. Registrar no Supabase deste app com o `secrets set` acima.

A chave nunca entra no `.env` nem em nada com prefixo `VITE_`: ali ela viraria
texto visível no site publicado. O único lugar dela é o segredo da Edge
Function.

Sem a função publicada o app não quebra: o Perfil mostra o parágrafo das regras
com um "tentar de novo", e as abas seguem com os insights calculados.

## Liberar a Google Agenda (uma vez só, no Google Cloud)

No mesmo projeto do Google Cloud onde está o OAuth usado pelo Supabase:

1. **APIs e serviços → Biblioteca → Google Calendar API → Ativar.**
2. **Google Auth Platform → Acesso a dados → Adicionar ou remover escopos →**
   marcar os dois:
   - `https://www.googleapis.com/auth/calendar.events` — ver e editar compromissos;
   - `https://www.googleapis.com/auth/calendar.readonly` — enxergar a lista de
     agendas (Estudos, Exercícios, Pets...). Sem esse, o app mostra só a agenda
     principal.

   Esse é o menu que antigamente se chamava "Escopos".
3. **Público-alvo** → se o app estiver em modo "Teste", a conta precisa estar em
   **Usuários de teste**.

Depois disso, clicar em "Conectar Google Agenda" de novo pra o Google pedir a
nova permissão.

## Instalar no celular (PWA)

Abrir https://meu-ritmo.vercel.app no celular e usar "Adicionar à tela de
início" (iPhone/Safari) ou "Instalar app" (Android/Chrome). O ícone, o nome e o
funcionamento offline básico vêm de [public/manifest.webmanifest](public/manifest.webmanifest)
e [public/sw.js](public/sw.js).

## Publicar uma nova versão

```bash
npx vercel --prod
```
