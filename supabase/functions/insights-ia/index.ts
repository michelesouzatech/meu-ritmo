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

import { createClient } from 'jsr:@supabase/supabase-js@2'

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
// DESTINO_ROTA em src/lib/aiInsights.js.
const AREAS = ['habitos', 'forca', 'corrida', 'diario', 'tarefas']

// Pra onde uma ação sugerida pode levar. É AREAS mais a agenda, que aparece na
// Home e não tem painel de insight próprio.
const DESTINOS = [...AREAS, 'agenda']

const semAcento = (texto: string) =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Mesma conta de dia da semana que src/lib/aiSummary.js faz no front, pra
// conferir contra "fatos.ultimoTreino" sem precisar confiar que o modelo leu
// o campo certo.
const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const weekdayOf = (iso: string) => WEEKDAY[new Date(`${iso}T00:00:00`).getDay()]

// O prompt já pede pra nunca ler a data da última carga como a data do
// último treino (ver MOMENTOS/buildPrompt), e mesmo assim já saiu errado — foi
// esse exato caso que abriu o problema: "seu último treino registrado foi em
// 17 de agosto" no dia 20, com treino no diário do dia 18 (ver comentário em
// src/lib/aiSummary.js). "cargas" fica bem perto da frase no resumo e puxa o
// modelo pro dia errado. Isto é a rede embaixo, no mesmo espírito de
// não confia que a instrução sozinha basta, confere o fato depois que o
// texto já saiu.
const SEM_FEIRA = new Set(['domingo', 'sábado'])
const rotuloDoDia = (dia: string, comFeira: boolean) =>
  comFeira && !SEM_FEIRA.has(dia) ? `${dia}-feira` : dia

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// A data que o modelo pode citar aparece em três formatos: dia da semana
// ("quarta"), numérico ("17/08") ou por extenso ("17 de agosto") — o bug
// original era justamente o formato por extenso, que a primeira versão desta
// rede não pegava.
const DIA_SEMANA_RE =
  '(?:domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)'
const DATA_NUMERICA_RE = '\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?'
const DATA_MES_RE = `\\d{1,2}\\s+de\\s+(?:${MESES.join('|')})`
const DATA_RE = `(${DIA_SEMANA_RE}|${DATA_NUMERICA_RE}|${DATA_MES_RE})`

// Três jeitos de afirmar "quando foi o último treino", os que já apareceram
// na prática: "não treina desde X", "último treino ... foi/aconteceu/
// registrado ... em X" (o caso real) e "treinou ... pela última vez ... em
// X". Até 60 caracteres de distância entre o gatilho e a data — perto o
// bastante pra ser a mesma afirmação, longe o bastante pra cobrir "não treina
// há 4 dias, desde segunda". Conservador de propósito: errar pro lado de não
// corrigir custa uma frase errada; errar pro outro lado estraga uma frase que
// estava certa.
const CLAIM_TREINO_DATA = new RegExp(
  '(?:' +
    `n[aã]o\\s+trein\\w*[^.]{0,60}?desde` +
    `|[uú]ltim[oa]\\s+trein\\w*[^.]{0,60}?(?:foi|aconteceu|registrad\\w*)[^.]{0,30}?(?:em|dia)` +
    `|trein\\w*[^.]{0,50}?pela\\s+[uú]ltima\\s+vez[^.]{0,30}?(?:em|dia)` +
  `)\\s+${DATA_RE}`,
  'gi',
)

const estiloDaData = (data: string): 'semana' | 'numerica' | 'mes' => {
  if (new RegExp(`^${DIA_SEMANA_RE}$`, 'i').test(data)) return 'semana'
  if (/^\d{1,2}\//.test(data)) return 'numerica'
  return 'mes'
}

// Confere a data citada contra a data correta no MESMO formato em que ela foi
// citada — comparar "quarta" com "17/08" não diz nada.
function mesmaData(iso: string, dataCitada: string, estilo: 'semana' | 'numerica' | 'mes'): boolean {
  const d = new Date(`${iso}T00:00:00`)
  if (estilo === 'semana') {
    const citadoNormalizado = semAcento(dataCitada).replace('-feira', '')
    return citadoNormalizado === semAcento(weekdayOf(iso))
  }
  if (estilo === 'numerica') {
    const [diaC, mesC] = dataCitada.split('/').map((n) => parseInt(n, 10))
    return diaC === d.getDate() && mesC === d.getMonth() + 1
  }
  const m = dataCitada.match(/^(\d{1,2})\s+de\s+(\p{L}+)/u)
  if (!m) return true
  const mes = MESES.findIndex((nome) => semAcento(nome) === semAcento(m[2]))
  return parseInt(m[1], 10) === d.getDate() && mes === d.getMonth()
}

function rotuloCorreto(iso: string, estilo: 'semana' | 'numerica' | 'mes', comFeira: boolean): string {
  const d = new Date(`${iso}T00:00:00`)
  if (estilo === 'semana') return rotuloDoDia(weekdayOf(iso), comFeira)
  if (estilo === 'numerica') {
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    return `${dia}/${mes}`
  }
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

function corrigirDiaDeTreino(texto: string, ultimoTreinoISO: string | null): string {
  if (!ultimoTreinoISO || !texto) return texto
  return texto.replace(CLAIM_TREINO_DATA, (trecho, dataCitada: string) => {
    const estilo = estiloDaData(dataCitada)
    if (mesmaData(ultimoTreinoISO, dataCitada, estilo)) return trecho
    const rotulo = rotuloCorreto(ultimoTreinoISO, estilo, /-feira/i.test(dataCitada))
    console.log('data de treino corrigida no texto:', dataCitada, '->', rotulo)
    return trecho.replace(dataCitada, rotulo)
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
  },
  required: ['perfil'],
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
  leia a data da última carga como a data do último treino. Qualquer frase que
  diga "não treina desde [dia]" ou "há X dias sem treinar" TEM que usar
  "fatos.ultimoTreino" (ou "forca.diasComTreinoDeForca") como fonte da data —
  nunca a data mais recente dentro de "cargas". Exemplo: se a última carga é
  de segunda e "fatos.ultimoTreino" diz quarta, a frase fala de quarta.
- "regras" é o que o próprio app já calculou e JÁ ESTÁ ESCRITO NA TELA, no
  painel de cada aba. Ela só traz o que teve o que dizer: regra que ficou
  calada não aparece aí, e ficar calada quase sempre quer dizer que estava
  tudo certo — nunca leia a ausência de uma regra como problema.
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
- Não repita "regras" com outras palavras. Aquilo a pessoa já está lendo nas
  próprias abas de cada área.
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
- Nada de emoji dentro de título ou parágrafo.

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
    corridas), "diario" (como o treino foi), "tarefas", "agenda".`
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

  // A leitura de cada momento é uma só, não uma por aparelho — "marca" é a
  // mesma identidade dia:faixa que o front usa pro cache local (ver
  // lib/momento.js). Duas abas, ou o celular e o computador, abrindo o app na
  // mesma faixa não podem virar duas gerações (e duas cotas) do Gemini pra
  // perguntas idênticas.
  const marca = (summary as { momentoMarca?: string }).momentoMarca
  const momento = (summary as { momento?: string }).momento
  if (typeof marca !== 'string' || !marca.includes(':')) {
    return json({ error: 'payload', message: 'Resumo sem identificação do momento do dia.' }, 400)
  }
  const dia = marca.split(':')[0]

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas')
    return json({ error: 'config', message: 'Configuração do Supabase ausente.' }, 500)
  }

  // O token de quem chamou já foi conferido pelo gateway (verify_jwt) antes de
  // chegar aqui. Passá-lo adiante faz a RLS da tabela valer sozinha — não
  // precisa decidir "de quem é essa leitura" na mão, só repassar quem já está
  // autenticado.
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  const { data: userData, error: userError } = await supabaseUser.auth.getUser()
  const userId = userData?.user?.id
  if (userError || !userId) {
    return json({ error: 'auth', message: 'Precisa estar logada pra gerar a leitura.' }, 401)
  }

  const { data: existente } = await supabaseUser
    .from('ai_insights')
    .select('analise')
    .eq('marca', marca)
    .maybeSingle()

  if (existente?.analise) {
    // `{ gerando: true }` é a trava (ver abaixo): outra chamada já está com o
    // Gemini em andamento pra essa marca. Não é a leitura de verdade, então
    // não devolve como se fosse — devolve erro pra tela tentar de novo em
    // instantes, em vez de as duas chamadas caírem no Gemini juntas.
    if (existente.analise.gerando) {
      return json(
        { error: 'gerando', message: 'Essa leitura já está sendo gerada. Tenta de novo em alguns segundos.' },
        409,
      )
    }
    return json(existente.analise)
  }

  // Reserva a marca ANTES de chamar o Gemini: é o que impede duas chamadas
  // quase simultâneas (duas abas, celular e computador abrindo no mesmo
  // instante) de passarem as duas pela checagem de cache acima e disparar a
  // API em dobro. A unique key é (user_id, marca) — só a primeira consegue
  // inserir, a segunda cai no 23505 abaixo e nem chega a montar o prompt.
  const { error: travaError } = await supabaseUser
    .from('ai_insights')
    .insert({ user_id: userId, marca, dia, momento: momento ?? 'noite', analise: { gerando: true } })

  if (travaError) {
    if (travaError.code === '23505') {
      return json(
        { error: 'gerando', message: 'Essa leitura já está sendo gerada. Tenta de novo em alguns segundos.' },
        409,
      )
    }
    console.error('falha ao travar a geração', travaError)
    return json({ error: 'db', message: 'Não consegui começar a gerar a leitura agora.' }, 500)
  }

  // Se qualquer coisa der errado depois daqui, a trava tem que sair — senão
  // essa marca fica bloqueada pro resto do momento do dia, e nem o botão de
  // "tentar de novo" da tela ajuda.
  const destravar = async () => {
    const { error } = await supabaseUser.from('ai_insights').delete().eq('user_id', userId).eq('marca', marca)
    if (error) console.error('falha ao destravar a geração', error)
  }

  // Sem isto, uma resposta lenta ou pendurada do Gemini só cai quando o
  // Supabase mata a função no teto dela (150s), e a tela fica esse tempo
  // todo esperando pra então receber um 504 genérico. 25s é bem acima do que
  // uma geração saudável leva (o benchmark no comentário do thinkingConfig
  // abaixo mede segundos, não dezenas) e ainda deixa folga pra rede lenta.
  const GEMINI_TIMEOUT_MS = 25_000
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), GEMINI_TIMEOUT_MS)

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
      signal: timeoutController.signal,
    })
  } catch (err) {
    const foiTimeout = err instanceof Error && err.name === 'AbortError'
    console.error(foiTimeout ? 'Gemini não respondeu a tempo' : 'falha de rede ao chamar o Gemini', err)
    await destravar()
    return foiTimeout
      ? json({ error: 'timeout', message: 'O Gemini demorou demais pra responder. Tenta de novo.' }, 504)
      : json({ error: 'network', message: 'Não consegui falar com o Gemini agora.' }, 502)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const detail = await response.text()
    console.error('Gemini respondeu', response.status, detail)
    await destravar()

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
    await destravar()
    return json({ error: 'empty', message: 'O Gemini devolveu uma resposta vazia.' }, 502)
  }

  try {
    const parsed = JSON.parse(text)

    // O enum do schema já restringe destino, mas a tela navega com ele —
    // conferir aqui custa uma linha e garante que nada fora da lista chegue
    // no front.
    const acoes = (parsed.perfil?.acoes ?? [])
      .filter((acao: { destino?: string }) => DESTINOS.includes(acao.destino ?? ''))
      .slice(0, 3)

    const ultimoTreinoISO =
      (summary as { fatos?: { ultimoTreino?: string | null } }).fatos?.ultimoTreino ?? null

    const analise = {
      perfil: {
        titulo: corrigirDiaDeTreino(parsed.perfil?.titulo ?? '', ultimoTreinoISO),
        paragrafos: (parsed.perfil?.paragrafos ?? []).map((p: string) =>
          corrigirDiaDeTreino(p, ultimoTreinoISO),
        ),
        acoes,
      },
      modelo: GEMINI_MODEL,
      geradoEm: new Date().toISOString(),
    }

    // A linha já existe — é a trava que este mesmo pedido reservou lá em
    // cima, antes de chamar o Gemini — então aqui é update, não insert. Não
    // tem mais corrida com outro aparelho pra tratar: ninguém mais conseguiu
    // passar pela trava pra essa marca.
    const { error: updateError } = await supabaseUser
      .from('ai_insights')
      .update({ analise })
      .eq('user_id', userId)
      .eq('marca', marca)

    if (updateError) {
      console.error('falha ao gravar ai_insights', updateError)
    }

    return json(analise)
  } catch (err) {
    console.error('JSON inválido vindo do Gemini', err, text.slice(0, 500))
    await destravar()
    return json({ error: 'parse', message: 'A resposta do Gemini veio fora do formato.' }, 502)
  }
})
