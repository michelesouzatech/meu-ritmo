// Renova sozinha a permissão da Google Agenda.
//
// O token que o Google dá pra ler a agenda vale 1 hora. Junto com ele o Google
// pode dar um segundo token, o "refresh token", que não vence e serve só pra
// pedir tokens de acesso novos. Era o que faltava: sem ele, uma hora depois de
// conectar o app só sabia pedir pra conectar tudo de novo, na mão.
//
// A troca de refresh token por token de acesso exige o *segredo* do cliente
// OAuth (o mesmo que está em Authentication → Providers → Google). Segredo
// nenhum pode ir pro navegador — qualquer VITE_* vira texto visível no site
// publicado —, então essa troca mora aqui.
//
// O refresh token também nunca volta pro navegador: ele fica na tabela
// `google_tokens`, que tem RLS ligado e nenhuma policy. Nem a própria dona
// alcança a linha com a chave do site; só esta função, que usa a service role.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// "Não dá pra renovar" não é erro: é o app voltando a mostrar o botão de
// conectar. Por isso esses casos saem como 200 com `ok: false` — o `invoke` do
// supabase-js trata qualquer não-2xx como exceção, e aí o front teria que
// desembrulhar corpo de erro só pra descobrir algo que ele já sabe tratar.
type Motivo = 'sem_refresh' | 'sem_config' | 'revogado' | 'google'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const naoRenovou = (motivo: Motivo) => json({ ok: false, motivo })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) {
    console.error('faltam as variáveis do próprio Supabase')
    return json({ error: 'config', message: 'Função mal configurada.' }, 500)
  }

  // Quem chamou? Validar o JWT contra o servidor de auth é o que separa a dona
  // dos dados de alguém segurando a chave publicável, que está no bundle e
  // qualquer um lê.
  const autorizacao = req.headers.get('Authorization') ?? ''
  const comoUsuaria = createClient(url, anonKey, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await comoUsuaria.auth.getUser()
  if (!user) {
    return json({ error: 'auth', message: 'Precisa estar logada pra usar a agenda.' }, 401)
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let corpo: { acao?: string; refreshToken?: string }
  try {
    corpo = await req.json()
  } catch {
    corpo = {}
  }

  // Guarda o refresh token que veio na volta do "Conectar Google Agenda".
  if (corpo.acao === 'salvar') {
    if (!corpo.refreshToken) {
      return json({ error: 'pedido', message: 'Faltou o refresh token.' }, 400)
    }
    const { error } = await admin
      .from('google_tokens')
      .upsert(
        { user_id: user.id, refresh_token: corpo.refreshToken, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    if (error) {
      console.error('não deu pra guardar o refresh token', error)
      return json({ error: 'banco', message: 'Não deu pra guardar a conexão.' }, 500)
    }
    return json({ ok: true })
  }

  if (corpo.acao !== 'token') {
    return json({ error: 'pedido', message: 'Ação desconhecida.' }, 400)
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados')
    return naoRenovou('sem_config')
  }

  const { data: guardado, error: erroLeitura } = await admin
    .from('google_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (erroLeitura) {
    console.error('não deu pra ler o refresh token', erroLeitura)
    return json({ error: 'banco', message: 'Não deu pra ler a conexão.' }, 500)
  }
  if (!guardado?.refresh_token) return naoRenovou('sem_refresh')

  const resposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: guardado.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    // `invalid_grant` é o Google dizendo que esse refresh token morreu: a
    // pessoa tirou a permissão, trocou a senha, ou o app ainda está em modo
    // "Teste" no Google Cloud (ali o refresh token vence em 7 dias). Jogar a
    // linha fora evita ficar batendo num token que nunca mais vai funcionar.
    if (dados?.error === 'invalid_grant') {
      await admin.from('google_tokens').delete().eq('user_id', user.id)
      return naoRenovou('revogado')
    }
    console.error('Google recusou a renovação', resposta.status, dados)
    return naoRenovou('google')
  }

  if (!dados?.access_token) return naoRenovou('google')

  return json({
    ok: true,
    accessToken: dados.access_token,
    // Em segundos, como o Google manda. Costuma ser 3599.
    expiraEm: Number(dados.expires_in) || 3600,
  })
})
