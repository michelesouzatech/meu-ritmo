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
  conexão usa `supabase.auth.linkIdentity`, que precisa do "manual linking"
  ligado em Authentication → Providers no painel do Supabase. Como esse
  token vale 1 hora e não é renovado sozinho, a tela inicial mostra o botão
  "Reconectar Google Agenda" quando ele vence.
- **Arquivos:** foto de perfil no bucket `avatars`, foto/PDF do treino no bucket
  `treinos` (privado, aberto por link temporário).
- **Segurança:** RLS ligado nas 7 tabelas — cada conta só enxerga e mexe nos
  próprios dados.

### Tabelas

`tasks`, `habits`, `habit_completions`, `workouts`, `exercises`, `carga_logs`,
`body_fat`. (A agenda não é salva no banco — é lida direto do Google a cada
abertura.)

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
