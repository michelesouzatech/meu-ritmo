// Junta nomes numa frase natural: "água, leitura e treino".
export function joinNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// Como joinNames, mas corta a lista pra não virar um textão: com mais itens
// que "max + 1", mostra só os primeiros e soma o resto ("água, leitura e mais 2").
export function joinNamesCapped(names, max = 2) {
  if (names.length <= max + 1) return joinNames(names);
  return `${names.slice(0, max).join(", ")} e mais ${names.length - max}`;
}
