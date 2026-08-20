// Gera os insights escritos do app a partir do resumo agregado que o front
// manda (ver src/lib/aiSummary.js).
//
// A chave do Gemini mora aqui, no ambiente da função, e nunca no bundle do
// front-end: qualquer VITE_* vira texto visível no site publicado. Por isso a
// chamada ao Gemini passa por esta função em vez de sair direto do navegador.
//
// A função é chamada por uma pessoa logada. O `verify_jwt` do Supabase confere
// a assinatura de quem chamou, mas aceita também a chave publicável do site —
// que está no bundle e qualquer um lê. Sem a checagem de `chamadaAnonima`
// abaixo, dava pra queimar a cota do Gemini de fora do app.
//
// É uma chamada só pro app inteiro, não uma por aba. As cinco áreas se cruzam
// (o dia de treino explica o hábito que caiu, a agenda explica a tarefa
// encalhada), então dividir em cinco requisições gastaria cinco vezes a cota
// pra entregar uma leitura pior — cada pedaço cego sobre o resto.

// Versão fixa de propósito: os apelidos "-latest" trocam de modelo sozinhos, e
// o prompt daqui foi escrito em cima do comportamento deste. Se ele sair do ar
// um dia, o erro vem como 404 no log da função.
const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// As áreas que têm painel próprio numa aba do app. Precisa bater com o mapa
// AREA_KEY em src/lib/aiInsights.js.
const AREAS = ['habitos', 'forca', 'corrida', 'diario', 'tarefas']

// Pra onde uma ação sugerida pode levar. É AREAS mais a agenda, que aparece na
// Home e não tem painel de insight próprio.
const DESTINOS = [...AREAS, 'agenda']

// Os mesmos três tons que o painel já sabe desenhar (up = seta pra cima,
// down = seta pra baixo, tip = lâmpada). Inventar um quarto aqui deixaria a
// linha sem ícone na tela.
const TONS = ['up', 'down', 'tip']

// As chaves de `regras` vêm de lib/insights.js, em inglês; a resposta traz as
// áreas em português. "cross" entra em todas: é a leitura que cruza áreas, e é
// justamente a que a camada escrita tende a repetir com outras palavras.
const REGRAS_DA_AREA: Record<string, string[]> = {
  habitos: ['habits', 'cross'],
  forca: ['gym', 'cross'],
  corrida: ['running', 'cross'],
  diario: ['journal', 'cross'],
  tarefas: ['tasks', 'cross'],
}

const semAcento = (texto: string) =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const numerosDe = (texto: string) => new Set(texto.match(/\d+(?:[.,]\d+)?/g) ?? [])

// "8 dias" é um fato; "8" sozinho é um algarismo. Guardar o número colado na
// palavra que vem depois é o que separa "8 dias sem treinar" de "8 hábitos".
const medidasDe = (texto: string) =>
  new Set(
    [...semAcento(texto).matchAll(/(\d+(?:[.,]\d+)?)\s+(\p{L}+)/gu)].map((m) => `${m[1]} ${m[2]}`),
  )

// Conectivo longo o bastante pra passar no filtro de tamanho e vazio o
// bastante pra não dizer nada sobre o assunto da frase.
const VAZIAS = new Set([
  'quando', 'porque', 'tambem', 'ainda', 'entre', 'depois', 'antes', 'sobre',
  'dessa', 'desse', 'desta', 'deste', 'nesse', 'nessa', 'pelos', 'pelas',
  'todos', 'todas', 'muito', 'menos', 'mesmo', 'mesma', 'onde', 'como', 'seus',
  'suas', 'esses', 'essas', 'estes', 'estas', 'aquilo', 'enquanto',
])

const palavrasDe = (texto: string) =>
  new Set((semAcento(texto).match(/\p{L}{5,}/gu) ?? []).filter((p) => !VAZIAS.has(p)))

// O começo do que a regra põe entre aspas: "Treino B – Foco em Quadríceps e
// Pernas" vira "treino b". A leitura escrita encurta o nome quase sempre, então
// comparar o nome inteiro nunca bateria.
function nomesCitados(regra: string) {
  return [...regra.matchAll(/"([^"]+)"/g)]
    .map((m) => semAcento(m[1]).split(/\s+/).slice(0, 2).join(' ').trim())
    .filter((nome) => nome.length >= 4)
}

// A leitura escrita é uma camada POR CIMA das regras, não no lugar delas — e as
// duas dividem o mesmo card, com a dela em cima. Quando ela reescreve o que a
// regra já diz, o card gasta duas linhas pra contar uma coisa só: foi o que
// aconteceu no painel de Força, onde a linha da IA e a regra logo abaixo
// contavam a mesma história do Treino B parado há 8 dias.
//
// O prompt já pede pra não repetir. Isto é a rede embaixo, e é deliberadamente
// conservadora: só derruba quando a frase divide com UMA MESMA regra um número
// específico E uma coisa que aquela regra nomeou. Bater nos dois é dizer a
// mesma coisa; bater num só é falar do mesmo assunto, o que é permitido — errar
// pro lado de deixar passar custa uma linha repetida, errar pro outro lado
// engole uma leitura que só ela tinha.
function ecoDeRegra(texto: string, regras: string[]) {
  const numeros = numerosDe(texto)
  // Frase sem número nenhum não dá pra acusar de repetir uma conta.
  if (numeros.size === 0) return false

  const alvo = semAcento(texto)
  const medidas = medidasDe(texto)
  const palavras = palavrasDe(texto)

  return regras.some((regra) => {
    const numerosIguais = [...numerosDe(regra)].filter((n) => numeros.has(n))
    if (numerosIguais.length === 0) return false

    const palavrasRegra = palavrasDe(regra)
    const comuns = [...palavras].filter((p) => palavrasRegra.has(p)).length

    // Quatro sinais independentes de que é a mesma afirmação. UM SÓ NÃO BASTA:
    // "Treino A" citado de passagem numa leitura sobre corrida divide o nome
    // com a regra da ficha e não está dizendo a mesma coisa. Dois sinais já é
    // difícil de ser coincidência.
    const sinais = [
      nomesCitados(regra).some((nome) => alvo.includes(nome)),
      [...medidasDe(regra)].some((m) => medidas.has(m)),
      numerosIguais.length >= 2,
      palavras.size > 0 && comuns / palavras.size >= 0.6,
    ].filter(Boolean).length

    return sinais >= 2
  })
}

// Forçar JSON com schema evita o passo frágil de tentar extrair texto de uma
// resposta em prosa livre — o modelo devolve exatamente esses campos ou a
// requisição falha, e a tela nunca recebe algo meio montado.
const responseSchema = {
  type: 'OBJECT',
  properties: {
    perfil: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING' },
        paragrafos: { type: 'ARRAY', items: { type: 'STRING' } },
        acoes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              emoji: { type: 'STRING' },
              texto: { type: 'STRING' },
              impacto: { type: 'STRING' },
              // Enum fechado em vez de texto livre: é o que deixa o botão
              // levar pra algum lugar de verdade. Um destino inventado viraria
              // clique morto, e adivinhar a aba pela frase erraria cedo ou
              // tarde.
              destino: { type: 'STRING', enum: DESTINOS },
            },
            required: ['emoji', 'texto', 'impacto', 'destino'],
          },
        },
      },
      required: ['titulo', 'paragrafos', 'acoes'],
    },
    areas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          area: { type: 'STRING', enum: AREAS },
          tom: { type: 'STRING', enum: TONS },
          texto: { type: 'STRING' },
        },
        required: ['area', 'tom', 'texto'],
      },
    },
  },
  required: ['perfil', 'areas'],
}

// A assinatura do token já foi conferida pelo gateway antes de chegar aqui, e
// o segredo pra refazer essa conta não mora nesta função. Então o que falta é
// só olhar QUEM chamou, lendo o corpo do JWT.
//
// A regra é deliberadamente frouxa: recusa só os dois credenciais públicos
// conhecidos — a chave publicável nova, que nem é um JWT, e a chave anônima
// antiga, que vem com `role: "anon"`. Qualquer outra coisa que o gateway tenha
// aceitado passa. Errar pro lado de recusar deixaria a leitura fora do ar pra
// ela; errar pro lado de aceitar custa, no pior caso, uma geração de cota.
function chamadaAnonima(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return true

  const corpo = token.split('.')[1]
  if (!corpo) return true // sb_publishable_… não tem as três partes de um JWT

  try {
    const base64 = corpo.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return payload.role === 'anon'
  } catch {
    return true
  }
}

// O app gera três leituras por dia, e o que muda entre elas não são os dados —
// vão os mesmos nas três — é a pergunta. De manhã o dia ainda não aconteceu, e
// a única coisa útil a dizer é o que ele pede. À noite ele já aconteceu, e aí
// cabe a conta do que rendeu e o cruzamento com as semanas anteriores.
//
// Sem esta divisão, as três chamadas devolveriam o mesmo texto em palavras
// levemente diferentes — o que gasta três vezes a cota pra parecer que o app
// mudou de opinião sozinho ao longo do dia.
const MOMENTOS: Record<string, { paragrafos: string; acoes: string; instrucoes: string }> = {
  manha: {
    paragrafos: '1 a 2 parágrafos',
    acoes: '2 a 3',
    instrucoes: `É a leitura da manhã: o dia ainda não andou. Escreva sobre o que
ele pede, não sobre o que ele rendeu.
- Olhe pra frente: os compromissos de hoje na agenda, as tarefas com data de
  hoje, as que já estão atrasadas, os hábitos que ainda não foram marcados hoje
  e o que o plano de corrida ainda cobra nesta semana.
- "marcadoHoje: false" às oito da manhã não é falha nenhuma — é hábito que ainda
  cabe no dia. Nunca escreva isso como atraso ou queda.
- Cite o dia de hoje pelo que ele tem: se a agenda mostra três compromissos e
  duas tarefas vencendo, diga o que dá pra encaixar entre eles.
- As ações são pra hoje, e a pessoa vai lê-las antes de sair de casa: uma tem
  que caber no dia que ela tem pela frente.
- Ela sai às 08h e fica na tela até as 14h. É cedo: quase nada do dia deu tempo
  de acontecer ainda, e cobrar alguma coisa aqui é cobrar o futuro.`,
  },
  tarde: {
    paragrafos: '1 parágrafo, 2 no máximo',
    // Uma ação basta: sobrou meio dia, e três sugestões pra encaixar em meio dia
    // viram lista que ela não vai cumprir.
    acoes: '1 a 2',
    instrucoes: `É a leitura da tarde: o dia está na metade. Escreva sobre o que
ainda dá tempo, não sobre a semana inteira.
- Compare o que já foi registrado hoje com o que estava pra acontecer: hábito
  marcado ou não, treino registrado ou não, tarefa de hoje concluída ou não.
- O que sobrou do dia é o assunto principal. Se ainda vem compromisso na agenda
  hoje, ele muda o que cabe — diga isso.
- É a mais curta das três. Escolha a coisa mais importante que ainda cabe hoje e
  fique nela; deixe a leitura larga de tendência pra noite.
- Ela sai às 14h e fica na tela até as 23h, então pode estar sendo lida às 21h,
  com o dia quase fechado. Use a hora acima pra saber quanto sobrou de verdade.
- Se o dia já andou bem, diga isso e pare. Inventar pendência pra ter o que
  escrever é pior que uma leitura curta.`,
  },
  noite: {
    paragrafos: '2 a 3 parágrafos',
    acoes: '2 a 3',
    instrucoes: `É a leitura da noite: o dia fechou. É a mais completa das três,
e a única que puxa a linha longa.
- Comece pelo que hoje rendeu — os registros com data de hoje — e daí vá pro que
  eles dizem junto com as semanas anteriores.
- É aqui que moram os cruzamentos entre áreas: o dia da semana em que a corrida
  acontece e o dia em que os hábitos caem, a carga que parou de subir e o diário
  marcando "cansada", a agenda cheia e a tarefa encalhada.
- O que não aconteceu hoje não vira cobrança: vira o que amanhã recebe. Se a
  agenda de amanhã já mostra o dia apertado, diga onde a coisa cabe.
- Feche olhando pra amanhã, não pra hoje.
- Ela sai às 23h e fica na tela até as 08h do dia seguinte. Se "geradaComAtraso"
  vier true, ela abriu o app depois da meia-noite e você está escrevendo a
  leitura das 23h com o relógio já virado: "hoje", no resumo, é o dia que
  fechou, e é dele que você fala. Não deseje boa noite nem bom dia, e não
  comente a hora — é a mesma leitura de fechamento, só lida mais tarde.`,
  },
}

function buildPrompt(summary: unknown) {
  const s = summary as {
    hoje?: string
    diaDaSemana?: string
    janelaDeDias?: number
    momento?: string
    momentoNome?: string
    hora?: string
  }

  // Cai na noite quando o momento não veio: é a leitura completa, a mesma que o
  // app fazia quando era uma por dia. Acontece com aparelho segurando um bundle
  // antigo no cache do service worker.
  const momento = MOMENTOS[s.momento ?? ''] ?? MOMENTOS.noite

  return `Você é o assistente do Meu Ritmo, um app de rotina pessoal. Escreve em
português do Brasil, na segunda pessoa, falando com a própria dona desses
registros. Ela é mulher — use concordância no feminino quando precisar.

Hoje é ${s.hoje ?? '?'} (${s.diaDaSemana ?? '?'}), são ${s.hora ?? '?'}. O resumo
abaixo cobre os últimos ${s.janelaDeDias ?? 60} dias de cinco áreas: hábitos,
força (academia), corrida, diário de treino e tarefas — mais a agenda, quando
conectada.

O MOMENTO DO DIA
Este app escreve três leituras por dia, em horário fixo: a da manhã às 08h, a da
tarde às 14h e a da noite às 23h. Cada uma fica na tela até a próxima entrar.
Esta é a da ${s.momentoNome ?? 'noite'}, e ela tem trabalho próprio.

${momento.instrucoes}

Use a hora acima pra saber onde o dia está de verdade — cada faixa é larga, e
ela pode estar abrindo o app na ponta dela.

As outras leituras de hoje você não viu, e ela viu. Não escreva como quem
continua um texto anterior ("como falei mais cedo"). E quando já houve uma antes
desta hoje, não repita o que ela provavelmente disse: se a única coisa que você
tem é o que já valia de manhã, escreva menos.

${JSON.stringify(summary, null, 2)}

COMO LER O RESUMO
- "marcacoesPorSemana" começa na semana atual, que ainda está em andamento.
  Nunca leia o número da primeira posição como queda sem dizer que a semana não
  fechou.
- "disposicao" vai de 1 (acabada) a 5 (ótima) e existe em TODO registro,
  inclusive nos de descanso: ela marca como se sentiu no dia de folga também.
  Mas nunca junte os dois numa média só — "disposição nos treinos" conta apenas
  registros com "tipo" diferente de "descanso". Pra ler recuperação, o que vale
  é o dia seguinte a um descanso comparado com o dia seguinte a um treino.
- "diario[].anotacao" é o que ela mesma escreveu sobre aquele treino, com as
  palavras dela. É conteúdo, não rótulo: leia, use e cite. A disposição diz o
  quanto o treino custou; a anotação costuma dizer por quê.
- Leia TODAS as anotações do período antes de escrever qualquer coisa, não só
  as dos últimos dias. É o único campo do resumo onde ela explica alguma coisa;
  todo o resto é número.
- "diario[].tipo" diz o que foi aquele registro: "força" (e aí "ficha" traz o
  nome da ficha que ela fez), "corrida", "descanso" ou "outra atividade".
  Registro de descanso é registro: ela abriu o app e marcou o dia. Não é dia
  vazio, e não é falta — é uma decisão de treino como qualquer outra, e
  "fatos.diasDeDescanso" diz em que dias ela tomou essa decisão. Descanso nunca
  entra numa frase como falha, ausência ou semana perdida.
- "cargas" está em ordem cronológica: a última posição é o registro mais
  recente. O peso é texto livre, do jeito que ela digitou.
- UM TREINO DE ACADEMIA É REGISTRADO POR DUAS VIAS INDEPENDENTES: lançando
  carga nos exercícios ("forca.diasComCargaLancada") ou marcando a ficha no
  diário ("forca.diasComFichaNoDiario"). "forca.diasComTreinoDeForca" é a união
  das duas — é ele que responde "quando ela treinou". Fazer a ficha e não
  atualizar o peso é comum e não quer dizer que o treino não aconteceu. Nunca
  leia a data da última carga como a data do último treino.
- "regras" é o que o próprio app já calculou e JÁ ESTÁ ESCRITO NA TELA, num
  painel logo abaixo do seu texto. Ela só traz o que teve o que dizer: regra
  que ficou calada não aparece aí, e ficar calada quase sempre quer dizer que
  estava tudo certo — nunca leia a ausência de uma regra como problema.
- "fatos" é a conta de cobertura dos últimos 14 dias, fechada pelo app e
  mandada sempre: quantos dias ela treinou, quantos viraram registro no diário,
  em quantos ela escreveu texto, quais dias ficaram sem registro. Ver SOBRE
  AUSÊNCIA mais abaixo — é a regra mais importante deste prompt.

SOBRE OS NÚMEROS
- Use apenas números que estão no resumo, ou contas simples feitas a partir
  deles (diferenças, somas, médias, percentuais). Nunca invente um valor.
- Se um dado necessário não está no resumo, não fale sobre ele. É melhor
  escrever menos do que preencher buraco com suposição.
- Um registro só não é tendência. Com dois, diga "de X pra Y"; com um, diga que
  falta o segundo.

SOBRE AUSÊNCIA — A REGRA MAIS IMPORTANTE DAQUI
Afirmar que alguma coisa NÃO existe é o único tipo de frase que você não
consegue conferir sozinho, e é onde este app já errou feio na cara dela.
- O bloco "fatos" é a conta de cobertura dos últimos 14 dias, fechada pelo
  próprio app. Ele é a ÚNICA fonte autorizada pra qualquer frase sobre o que ela
  não fez, não registrou ou não escreveu. Sem número de lá, a frase não existe.
- Nunca deduza ausência cruzando duas listas por conta própria. Já saiu na tela
  "você treinou 5 vezes nas últimas duas semanas, mas não deixou nenhum relato
  no diário" — no mesmo painel que citava, três linhas abaixo, o que ela tinha
  escrito no diário. Ela registra. O que faltava era você olhar o número certo.
- REGISTRAR NO DIÁRIO E ESCREVER UMA ANOTAÇÃO SÃO DUAS COISAS DIFERENTES, e
  "fatos" conta as duas separadas: "dessesRegistrouNoDiario" é quantos dias de
  treino viraram registro; "diasComAnotacaoEscrita" é em quantos ela escreveu
  texto. Se for falar de uma, diga qual, com a palavra certa. Marcar a carinha
  do dia já é registrar.
- "diasDeTreinoSemRegistro" traz as datas exatas que ficaram sem registro.
  Vazio quer dizer que ela registrou tudo: nesse caso não existe frase a
  escrever sobre falta de registro, e insistir nela é inventar. Escreva sobre
  outra coisa.
- Vale pra todas as áreas, não só pro diário: hábito sem marcação hoje de manhã
  não é hábito abandonado, e ficha sem carga nova não é treino que não
  aconteceu.

SOBRE O QUE VOCÊ NÃO SABE
- Título de compromisso, título de tarefa e nome de hábito são rótulos que ela
  escreveu, não descrições. Não deduza espécie, parentesco, profissão,
  finalidade nem nenhuma outra categoria a partir de um nome próprio. "Banho e
  tosa do Theo e da Chloe" diz que existe um banho e tosa marcado na segunda —
  não diz que Theo e Chloe são cachorros, nem que são bichos dela.
- Ao citar um compromisso ou uma tarefa, repita o rótulo como ele está e pare
  aí. O que ele significa é assunto dela, não seu.
- A regra vale pra tudo que não está escrito no resumo, não só pros números: se
  você precisou supor alguma coisa pra a frase fazer sentido, corte a frase.
- A anotação do diário é o outro lado disso, não uma exceção à regra: lá ela
  está te contando como o treino foi, então usar o que está escrito é ler, não
  deduzir. O limite continua sendo o texto. "Joelho doendo" é o que ela relatou
  naquele dia — não vira diagnóstico, não vira lesão, e não se estende aos dias
  em que ela não escreveu nada.

O QUE ESCREVER
- Não repita "regras" com outras palavras. Aquilo a pessoa já está lendo. Se a
  única coisa que você tem a dizer sobre uma área é o que a regra já disse,
  não escreva nada sobre essa área — a lista "areas" pode vir sem ela.
- Seu trabalho é o que nenhuma regra fez: cruzar áreas que o app mostra
  separadas. O dia da semana em que a corrida acontece e o dia em que os
  hábitos caem. A carga que parou de subir e o diário marcando "cansada". A
  agenda cheia e a tarefa que está encalhada há duas semanas. O quanto disso
  cabe nesta leitura, quem manda é o momento do dia lá em cima.
- A ANOTAÇÃO DO DIÁRIO É A PRIMEIRA EXPLICAÇÃO A PROCURAR, sempre. Antes de
  escrever sobre qualquer queda, mudança ou semana ruim em QUALQUER área, olhe
  se existe anotação no diário naquele período. Se existe e ela explica, é ela
  que entra na frase — não uma hipótese sua. Ela escreveu "dormi mal" na quinta
  e o supino caiu na sexta; escreveu "corrida leve pra soltar" no dia de pace
  alto. Traga o trecho dela entre aspas, curto, em vez de parafrasear.
- Anotação que se repete é sinal: a mesma queixa em três registros diferentes
  vale mais que qualquer uma delas sozinha. Diga em quantos dias ela apareceu.
- Nunca feche uma frase com conselho genérico do tipo "quando cai assim o
  assunto raramente é o exercício", "vale conferir se foi cansaço" ou "cuide do
  sono e da alimentação". Isso serviria pra qualquer pessoa em qualquer dia, e
  é exatamente o que faz o app parecer que não leu nada. Ou você tem o motivo
  escrito no diário e cita, ou fecha a frase nos números e para.
- Prefira a trajetória ao retrato: "era 3 vezes por semana, virou 1" vale mais
  que "1 vez por semana".
- Quando apontar uma queda, procure no resumo de onde ela veio. Uma queda com
  explicação é útil; uma queda solta é só cobrança.

SOBRE O TOM
- Direta e concreta, como uma amiga que acompanha a rotina dela de perto. Sem
  julgamento moral, sem "você deveria", sem paternalismo, sem alarmismo.
- Ela registra a vida dela nesse app há pouco tempo. Elogie o que está de pé
  antes de apontar o que caiu.
- Nada de emoji dentro de título, parágrafo ou texto de área.

FORMATO
- "perfil.titulo": uma frase de no máximo 90 caracteres com a leitura
  principal do momento dela.
- "perfil.paragrafos": ${momento.paragrafos}, cada um com no máximo 45 palavras.
  É aqui que moram os cruzamentos entre áreas.
- "perfil.acoes": ${momento.acoes} sugestões concretas. Cada uma tem:
  - "emoji": um único emoji que represente literalmente o assunto — corrida →
    🏃‍♀️, academia → 🏋️‍♀️, água → 💧, sono → 😴, descanso → 🛌, leitura → 📖,
    diário → 📓, tarefa → ✅, agenda → 📅, alongamento → 🧘‍♀️. NUNCA use emoji
    genérico de marcador como 📌, 📊, 🔍 ou 🏷️: se ele serviria pra qualquer
    ação, está errado.
  - "texto": a ação no infinitivo, até 60 caracteres.
  - "impacto": até 45 caracteres, o efeito esperado. Use número concreto
    sempre que o resumo sustentar um ("+2 dias/semana", "fecha a semana do
    plano"). Só descreva em palavras quando não houver base numérica.
  - "destino": onde ela resolve isso, exatamente um destes — "habitos",
    "forca" (exercícios e carga da academia), "corrida" (provas, plano e
    corridas), "diario" (como o treino foi), "tarefas", "agenda".
- "areas": no máximo 2 itens por área, e é para vir vazia quando não houver o
  que acrescentar. Cada item tem:
  - "area": uma de "habitos", "forca", "corrida", "diario", "tarefas".
  - "tom": "up" pro que está evoluindo, "down" pro que precisa de atenção,
    "tip" pra sugestão.
  - "texto": 1 ou 2 frases, no máximo 40 palavras. Escreva como quem fala com
    ela, não como legenda de gráfico.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (chamadaAnonima(req)) {
    return json({ error: 'auth', message: 'Precisa estar logada pra gerar a leitura.' }, 401)
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.error('GEMINI_API_KEY não configurada')
    return json({ error: 'config', message: 'A chave do Gemini não está configurada.' }, 500)
  }

  let summary: unknown
  try {
    summary = (await req.json())?.summary
  } catch {
    summary = null
  }

  if (!summary || typeof summary !== 'object') {
    return json({ error: 'payload', message: 'Resumo ausente ou inválido.' }, 400)
  }

  let response: Response
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(summary) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.4,
          // Mais folga de "pensamento" que a função equivalente do FinPilot:
          // lá as contas chegavam prontas e o trabalho era redação, aqui o
          // modelo precisa cruzar cinco áreas e descartar o que as regras já
          // disseram. Se a geração ficar lenta demais pra tela, é o primeiro
          // número a baixar.
          thinkingConfig: { thinkingBudget: 512 },
        },
      }),
    })
  } catch (err) {
    console.error('falha de rede ao chamar o Gemini', err)
    return json({ error: 'network', message: 'Não consegui falar com o Gemini agora.' }, 502)
  }

  if (!response.ok) {
    const detail = await response.text()
    console.error('Gemini respondeu', response.status, detail)

    // 429 é o caso esperado no plano gratuito: a cota do dia acabou. Vale uma
    // mensagem própria porque a saída é só esperar, não mexer em nada.
    if (response.status === 429) {
      return json(
        { error: 'quota', message: 'A cota gratuita do Gemini de hoje acabou. Tente amanhã.' },
        429,
      )
    }

    return json({ error: 'gemini', message: 'O Gemini não conseguiu responder agora.' }, 502)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    // Acontece quando o filtro de segurança do Gemini bloqueia a resposta: vem
    // 200 com candidato vazio, não um erro HTTP.
    console.error('resposta do Gemini sem texto', JSON.stringify(data).slice(0, 800))
    return json({ error: 'empty', message: 'O Gemini devolveu uma resposta vazia.' }, 502)
  }

  try {
    const parsed = JSON.parse(text)

    // O enum do schema já restringe destino, área e tom, mas a tela navega com
    // o destino e escolhe ícone pelo tom — conferir aqui custa três linhas e
    // garante que nada fora da lista chegue no front.
    const acoes = (parsed.perfil?.acoes ?? [])
      .filter((acao: { destino?: string }) => DESTINOS.includes(acao.destino ?? ''))
      .slice(0, 3)

    const regras = (summary as { regras?: Record<string, string[]> }).regras ?? {}

    const areas = (parsed.areas ?? [])
      .filter(
        (item: { area?: string; tom?: string; texto?: string }) =>
          AREAS.includes(item.area ?? '') && TONS.includes(item.tom ?? '') && !!item.texto,
      )
      .filter((item: { area: string; texto: string }) => {
        const daArea = (REGRAS_DA_AREA[item.area] ?? []).flatMap((chave) => regras[chave] ?? [])
        if (!ecoDeRegra(item.texto, daArea)) return true
        // Vai pro log da função, não pra tela: se o filtro começar a comer
        // leitura boa, é aqui que dá pra ver o que ele derrubou.
        console.log('área descartada por repetir uma regra:', item.area, '|', item.texto)
        return false
      })

    return json({
      perfil: {
        titulo: parsed.perfil?.titulo ?? '',
        paragrafos: parsed.perfil?.paragrafos ?? [],
        acoes,
      },
      areas,
      modelo: GEMINI_MODEL,
      geradoEm: new Date().toISOString(),
    })
  } catch (err) {
    console.error('JSON inválido vindo do Gemini', err, text.slice(0, 500))
    return json({ error: 'parse', message: 'A resposta do Gemini veio fora do formato.' }, 502)
  }
})
