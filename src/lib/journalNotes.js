// Lê a anotação do diário — o texto que ela mesma escreveu.
//
// Todo o resto do app trabalha com número: carga, disposição de 1 a 5,
// contagem de marcações. A anotação é o único lugar onde ela conta o PORQUÊ,
// e até aqui só o Gemini a enxergava. O motor de regras via um treino "2 de 5"
// e não via o "dormi 4 horas, exame deu B12 baixa" escrito do lado.
//
// O resultado disso eram as frases genéricas: a regra apontava a queda e
// fechava com um palpite ("o assunto raramente é o exercício") porque não
// tinha acesso à explicação que estava escrita duas telas ao lado.
//
// Aqui não há interpretação: o tema só existe se a palavra dela estiver no
// texto, e o que a frase final cita é um trecho do que ela escreveu, entre
// aspas. Nada é deduzido — se ela não escreveu, não vira insight.

// Acento e caixa saem só pra comparar. O texto original fica intocado, porque
// é dele que sai a citação.
const semAcento = (texto) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Os assuntos que aparecem numa anotação de treino e explicam alguma coisa em
// outra área. Cada um traz `label`, que é como o assunto entra numa frase
// ("você anotou dor em 3 registros").
//
// A lista é deliberadamente curta e óbvia: é melhor deixar um tema passar
// batido do que classificar errado o que ela escreveu. Padrão que não bate
// vira zero insight, não vira insight errado.
//
// `sintoma: true` marca o que é o efeito, não a causa. Cansaço é o exemplo
// único e é um caso importante: o app JÁ SABE que ela estava cansada, porque
// ela marcou disposição 2 e a carinha está na tela. Citar "cansada" como
// explicação da carga que caiu seria responder "porque você estava cansada" —
// verdadeiro, inútil, e exatamente o tipo de frase que ela reclamou. Então
// sintoma conta como tema (a repetição dele diz alguma coisa), mas nunca é
// escolhido pra explicar outra área: `noteExplanation` procura causa.
export const NOTE_THEMES = [
  {
    key: "exames",
    label: "os exames",
    test: /\bexame|\bb12\b|vitamina|ferritina|\bferro\b|hemograma|tireoid|anemia|taxa baixa|taxas baixas|deficiencia/,
  },
  {
    key: "saude",
    label: "estar doente",
    test: /gripe|resfriad|febre|garganta|virose|covid|dengue|sinusite|alergia|enjoo|nausea|infeccao|antibiotic|remedio novo/,
  },
  {
    key: "dor",
    label: "dor",
    test: /\bdor\b|\bdores\b|dolorid|doendo|\bdoi\b|\bdoia\b|\bdoeu\b|\bdoer\b|travad|lesao|estiramento|contratur|inflama/,
  },
  {
    key: "ciclo",
    label: "cólica ou TPM",
    test: /colica|\btpm\b|menstru|ciclo|corrimento/,
  },
  {
    key: "sono",
    label: "sono ruim",
    test: /dormi mal|dormi pouco|nao dormi|sem dormir|mal dormida|noite ruim|insonia|pouco sono|sono ruim|acordei varias vezes|virei a noite|dormi tarde/,
  },
  {
    key: "alimentacao",
    label: "não ter comido direito",
    test: /comi mal|nao comi|sem comer|em jejum|\bfome\b|sem almocar|pulei o almoco|pulei a refeicao|mal alimentada/,
  },
  {
    key: "estresse",
    label: "estresse",
    test: /estress|ansied|ansiosa|nervos|preocupa|correria|dia puxado|trabalho puxado|sobrecarreg/,
  },
  {
    key: "hidratacao",
    label: "beber pouca água",
    test: /desidrat|pouca agua|sem beber agua|nao bebi agua|bebi pouca/,
  },
  {
    key: "cansaco",
    label: "cansaço",
    sintoma: true,
    test: /cansa|exaust|acabada|sem energia|sem forca|sem disposicao|fadiga|esgotad|moida|arrastada|pesad[ao] demais/,
  },
];

// A ordem da lista acima é a ordem de força da explicação, da causa com nome
// ("o exame deu B12 baixa") pro sintoma solto. Ela é o critério de desempate:
// um "exame deu taxa baixa" escrito uma vez explica melhor uma queda do que
// quatro "cansada", que é onde a contagem pura errava.
const FORCA = new Map(NOTE_THEMES.map((tema, i) => [tema.key, NOTE_THEMES.length - i]));

// Todos os temas que uma anotação carrega. Uma anotação pode ter mais de um —
// "dormi mal e acordei com dor nas costas" é sono e dor, e as duas leituras
// são legítimas.
export function themesOf(notes) {
  if (!notes) return [];
  const alvo = semAcento(notes);
  return NOTE_THEMES.filter((tema) => tema.test.test(alvo));
}

// O trecho que vai entre aspas na frase final.
//
// Citar a anotação inteira é o que transformaria o insight num parágrafo, e
// citar as primeiras palavras erraria o assunto quando o motivo está no fim
// ("treino tranquilo, mas o joelho travou na última série"). Então a citação
// sai da oração que casou com o tema, não do começo do texto.
const MAX_CITACAO = 72;

function oracoes(texto) {
  return texto
    .split(/[.;!?\n]+|,\s+(?=\S)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function encurtar(trecho) {
  if (trecho.length <= MAX_CITACAO) return trecho;
  const corte = trecho.slice(0, MAX_CITACAO);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 30 ? corte.slice(0, espaco) : corte).trim()}…`;
}

export function quoteFor(notes, theme = null) {
  if (!notes?.trim()) return null;
  const partes = oracoes(notes.trim());
  if (partes.length === 0) return null;

  const escolhida =
    (theme && partes.find((p) => theme.test.test(semAcento(p)))) ?? partes[0];

  return encurtar(escolhida);
}

export function entriesWithNotes(entries = [], startISO = null, endISO = null) {
  return entries
    .filter((e) => e.notes?.trim())
    .filter((e) => (startISO ? e.date >= startISO : true))
    .filter((e) => (endISO ? e.date <= endISO : true))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Agrupa as anotações do período por tema, do mais forte pro mais fraco.
//
// A repetição pesa: "dormi mal" escrito uma vez é um dia ruim; escrito em
// quatro registros é o assunto da semana dela — e é uma leitura que nenhuma
// tela mostra, porque o diário exibe um dia de cada vez.
//
// Mas a repetição não decide sozinha, senão o tema mais vago vence sempre: ela
// escreve "cansada" em quase todo registro puxado, e escreve "o exame deu B12
// baixa" uma vez só. Contando, ganha o cansaço; lendo, quem explica é o exame.
// Por isso a força do tema vem antes da contagem no desempate.
export function themesInRange(entries = [], startISO = null, endISO = null) {
  const comNota = entriesWithNotes(entries, startISO, endISO);
  const porTema = new Map();

  for (const entry of comNota) {
    for (const tema of themesOf(entry.notes)) {
      if (!porTema.has(tema.key)) porTema.set(tema.key, { theme: tema, entries: [] });
      porTema.get(tema.key).entries.push(entry);
    }
  }

  return [...porTema.values()]
    .map(({ theme, entries: lista }) => {
      const ultima = lista[lista.length - 1];
      // A citação sai do registro que mais explica, não do mais recente.
      // "Exame deu taxas baixas de B12 e vitamina D" foi escrito na terça e
      // "acho que é a B12" na quarta; citar o último por ser o último devolve
      // pra ela o eco, e não o que ela contou. Entre duas anotações do mesmo
      // tema, a mais completa é a que tem a informação — e o `encurtar` já
      // impede que "mais completa" vire parágrafo.
      const melhor = [...lista].sort((a, b) => {
        const ta = quoteFor(a.notes, theme)?.length ?? 0;
        const tb = quoteFor(b.notes, theme)?.length ?? 0;
        return tb - ta || b.date.localeCompare(a.date);
      })[0];
      return {
        theme,
        key: theme.key,
        label: theme.label,
        sintoma: !!theme.sintoma,
        entries: lista,
        dates: lista.map((e) => e.date),
        count: lista.length,
        lastDate: ultima.date,
        quote: quoteFor(melhor.notes, theme),
        quoteDate: melhor.date,
      };
    })
    .sort(
      (a, b) =>
        FORCA.get(b.key) - FORCA.get(a.key) ||
        b.count - a.count ||
        b.lastDate.localeCompare(a.lastDate),
    );
}

// A explicação escrita pra alguma coisa que aconteceu em OUTRA área — a carga
// que caiu, a semana que sumiu. Devolve a causa mais forte que ela escreveu no
// período, ou nada.
//
// Sintoma fica de fora: explicar a carga caindo com "você anotou cansaço" é
// devolver pra ela o mesmo dado que ela acabou de digitar. Aqui só entra o que
// acrescenta — exame, dor, noite mal dormida, cólica, correria.
//
// Devolve `null` de propósito quando não há nada escrito: sem anotação, a
// regra que chamou isso aqui fecha a frase nos números e para. É exatamente o
// que evita o palpite genérico no lugar da explicação.
export function noteExplanation(entries = [], startISO, endISO) {
  const causas = themesInRange(entries, startISO, endISO).filter((t) => !t.sintoma);
  return causas.length > 0 ? causas[0] : null;
}
