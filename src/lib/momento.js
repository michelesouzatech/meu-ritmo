// Os três horários em que o app gera a leitura do dia: 08h, 14h e 23h.
//
// Eram faixas largas (00h, 12h, 18h) e a leitura nascia a qualquer hora dentro
// delas — quem abria o app 18h01 recebia a "leitura da noite" com o dia ainda
// andando. Agora os horários são a regra, não a referência: 08h abre o dia, 14h
// pega ele na metade, 23h fecha.
//
// Continua não existindo servidor batendo na porta dela. O que garante a hora
// exata é o timer de `msAteProximoMomento` com o app aberto — e ela deixa o app
// aberto no celular o dia inteiro. Com o app fechado, a leitura é gerada na
// primeira abertura depois da hora e continua sendo a leitura daquele horário,
// não uma leitura do momento em que ela abriu.
//
// A faixa da noite atravessa a meia-noite e só termina às 8h: quem abre o app
// 01h da manhã está no fim do dia que fechou, não no começo do que vem. Por
// isso todo momento carrega o `dia` a que pertence, e nessas horas ele volta
// um. Sem isso, a meia-noite geraria uma leitura da noite nova, com os mesmos
// dados que o app acabou de ler às 23h.
import { toISODate, addDays } from "./date.js";

const FAIXAS = [
  { chave: "noite", nome: "noite", desde: 23 },
  { chave: "tarde", nome: "tarde", desde: 14 },
  { chave: "manha", nome: "manhã", desde: 8 },
];

const VIRADAS = [8, 14, 23];

const doisDigitos = (n) => String(n).padStart(2, "0");
const relogio = (agora) => `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;

export function momentoAtual(agora = new Date()) {
  const hora = agora.getHours();
  const faixa = FAIXAS.find((f) => hora >= f.desde);
  const dataDeHoje = toISODate(agora);

  // Entre a meia-noite e as 8h nenhuma faixa bate, e é de propósito: ainda é a
  // leitura das 23h do dia anterior.
  if (!faixa) {
    return {
      chave: "noite",
      nome: "noite",
      hora: relogio(agora),
      dia: addDays(dataDeHoje, -1),
      // O relógio já virou o dia e a leitura é a de ontem. Quem monta o resumo
      // precisa saber, e é aqui que a informação existe — deduzir isso lá fora
      // comparando com o relógio de novo daria uma resposta que muda sozinha
      // conforme a hora em que a função é chamada.
      comAtraso: true,
    };
  }

  return {
    chave: faixa.chave,
    nome: faixa.nome,
    hora: relogio(agora),
    dia: dataDeHoje,
    comAtraso: false,
  };
}

// A identidade de uma leitura: a faixa MAIS o dia a que ela pertence.
//
// Comparar só a faixa faria a noite de terça e a de quarta parecerem a mesma
// coisa pra quem deixa o app aberto de um dia pro outro — e a leitura de quarta
// nunca seria gerada.
export const marcaDoMomento = (momento) => `${momento.dia}:${momento.chave}`;

// Quanto falta pra próxima virada, em milissegundos. Um timer só, em vez de
// perguntar a hora de minuto em minuto.
export function msAteProximoMomento(agora = new Date()) {
  const proxima = new Date(agora);
  const virada = VIRADAS.find((h) => h > agora.getHours());

  if (virada === undefined) {
    // Passou das 23h: a próxima virada é às 8h do dia seguinte, porque a faixa
    // da noite atravessa a meia-noite inteira.
    proxima.setDate(proxima.getDate() + 1);
    proxima.setHours(VIRADAS[0], 0, 0, 0);
  } else {
    proxima.setHours(virada, 0, 0, 0);
  }

  return proxima - agora;
}
