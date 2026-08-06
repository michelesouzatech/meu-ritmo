import { mixHex } from "./color.js";

// A escala do calendário vai de lilás a rosa profundo em vez de rosa claro a
// rosa profundo: o dia pouco cumprido deixa de ser mais um rosa na tela, e o
// tom mais escuro no início da escala mantém o número branco legível.
export function habitDayColor(count, total) {
  if (count === 0 || total === 0) return null;
  const ratio = Math.max(count / total, 0.2);
  return mixHex("#8465B8", "#B0116A", ratio);
}
