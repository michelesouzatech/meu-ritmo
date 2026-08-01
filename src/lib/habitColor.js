import { mixHex } from "./color.js";

export function habitDayColor(count, total) {
  if (count === 0 || total === 0) return null;
  const ratio = Math.max(count / total, 0.22);
  return mixHex("#FFD9EC", "#B0116A", ratio);
}
