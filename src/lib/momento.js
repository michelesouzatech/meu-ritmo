// Os três momentos em que o app gera uma leitura por dia: manhã, tarde e noite.
//
// As horas de referência (09h, 17h, 23h) são quando ela costuma abrir o app em
// cada período — não são horário de disparo. Não existe servidor batendo na
// porta dela: a leitura nasce quando o app abre dentro da faixa. Por isso as
// faixas cobrem o dia inteiro sem deixar buraco. Abrir 07h ainda cai na leitura
// da manhã, abrir 21h ainda cai na da noite; o que muda entre uma faixa e outra
// não é a hora exata, é o que a leitura tem para dizer.
//
// A faixa da manhã começa à meia-noite de propósito: quem abre o app 01h da
// manhã está no começo de um dia que ainda não andou, que é exatamente o
// assunto da leitura da manhã. A hora real vai junto no resumo, então o texto
// não sai desejando bom dia às duas da madrugada.
const FAIXAS = [
  { chave: "noite", nome: "noite", desde: 18 },
  { chave: "tarde", nome: "tarde", desde: 12 },
  { chave: "manha", nome: "manhã", desde: 0 },
];

const doisDigitos = (n) => String(n).padStart(2, "0");

export function momentoAtual(agora = new Date()) {
  const hora = agora.getHours();
  const faixa = FAIXAS.find((f) => hora >= f.desde);
  return {
    chave: faixa.chave,
    nome: faixa.nome,
    hora: `${doisDigitos(hora)}:${doisDigitos(agora.getMinutes())}`,
  };
}

// Quanto falta pra próxima virada de faixa, em milissegundos. Serve pra agendar
// um único timer em vez de ficar perguntando a hora de minuto em minuto: o app
// fica aberto o dia inteiro no celular dela, e a leitura da tarde precisa
// entrar sozinha às 12h sem depender de fechar e abrir de novo.
export function msAteProximoMomento(agora = new Date()) {
  const proxima = new Date(agora);
  const viradas = [12, 18, 24];
  const hora = viradas.find((h) => h > agora.getHours());
  proxima.setHours(hora, 0, 0, 0);
  return proxima - agora;
}
