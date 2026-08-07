import { mixHex } from "./color.js";

// A cor do dia no calendário de hábitos.
//
// Era uma escala de lilás a rosa profundo com o número em branco — trinta
// círculos saturados num mês, o que sozinho já pesava mais que o resto da
// tela. Agora é um matiz só e claro: do rosa quase branco ao rosa médio, com
// o número escuro. O calendário continua mostrando intensidade, só que por
// profundidade em vez de força de cor.
//
// O topo da escala para em #de73a7 porque é o rosa mais fundo em que a tinta
// escura ainda dá 4,5:1 de contraste. Escurecer mais obrigaria a virar o texto
// pra branco em algum ponto do meio — e existe uma faixa aí onde nem branco
// nem escuro passam.
export const HABIT_DAY_INK = "#5c0838";

export function habitDayColor(count, total) {
  if (count === 0 || total === 0) return null;
  const ratio = Math.max(count / total, 0.25);
  return mixHex("#ffe8f2", "#de73a7", ratio);
}
