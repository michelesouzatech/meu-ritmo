import { todayISO } from "./date.js";

const GROUP_A = "Treino A – Foco em Costas e Bíceps";
const GROUP_B = "Treino B – Foco em Quadríceps e Pernas";
const GROUP_C = "Treino C – Foco em Peito, Ombro e Tríceps";
const GROUP_D = "Treino D – Foco em Posterior de coxa e Glúteos";

export function buildInitialWorkoutSeed() {
  const today = todayISO();
  const carga = (weight) =>
    weight ? [{ id: crypto.randomUUID(), date: today, weight }] : [];
  const ex = (group, name, setsReps, weight, notes) => ({
    id: crypto.randomUUID(),
    group,
    name,
    setsReps,
    notes,
    cargaLogs: carga(weight),
  });

  return {
    createdAt: today,
    photoName: null,
    photoDataUrl: null,
    exercises: [
      ex(GROUP_A, "Puxada frente pronada", "4x12", "25kg", "Alternar pegada, controlar a descida"),
      ex(GROUP_A, "Puxada frente triângulo", "4x12", "25kg", "Cotovelos puxando pra baixo"),
      ex(GROUP_A, "Remada cavalinho", "4x10", "10kg", "Movimento inteiro, sem jogar o tronco"),
      ex(GROUP_A, "Rosca direta com halteres", "3x10", "6kg cada lado", "Cotovelos parados"),
      ex(GROUP_A, "Rosca corda polia", "3x12", "20kg", "Abrir a corda no final"),
      ex(GROUP_A, "Abd supra solo", "4x15", "", "Subida curta e controlada"),

      ex(GROUP_B, "Cadeira extensora", "3x15", "35kg", "30s de descanso, leve"),
      ex(GROUP_B, "Leg 45°", "4x12", "60kg", "Amplitude total"),
      ex(GROUP_B, "Hack squat", "3x15", "10kg cada lado", "Descer devagar, joelho alinhado"),
      ex(GROUP_B, "Cadeira adutora", "3x15", "35kg", "Apertar 1s no fim"),
      ex(GROUP_B, "Flexora em pé máquina", "3x10", "15kg", "Movimento curto e firme"),
      ex(GROUP_B, "Stiff", "4x12", "10kg cada lado", "Manter quadril colado"),

      ex(GROUP_C, "Supino inclinado halter", "4x10", "8kg cada lado", "Subida forte, descida lenta"),
      ex(GROUP_C, "Desenvolvimento halter", "4x10", "6kg cada lado", "Estabilizar ombros"),
      ex(GROUP_C, "Tríceps testa barra", "4x10", "5kg cada lado", "Cotovelos fechados"),
      ex(GROUP_C, "Tríceps puxada", "3x12", "15kg", "Estender total no final"),
      ex(GROUP_C, "Abdominal nas barras paralelas", "4x12", "", ""),
      ex(GROUP_C, "Abdominal russo", "3x10", "5kg", "Sentada, rotacione o tronco de um lado para o outro. Halter 5kg"),

      ex(GROUP_D, "Glúteo polia", "4x10", "15kg", "Contração forte no topo"),
      ex(GROUP_D, "Agachamento pêndulo", "4x10", "8kg cada lado", "Desce bem, subida explosiva"),
      ex(GROUP_D, "Elevação pélvica máquina", "4x12", "60kg", "Quadril alto, segurar no topo"),
      ex(GROUP_D, "Agachamento sumô", "3x10", "5kg cada lado", "Passo firme pra trás"),
      ex(GROUP_D, "Agachamento búlgaro", "3x10", "4kg cada lado", "Tronco levemente inclinado"),
      ex(GROUP_D, "Panturrilha sentada", "4x12", "5kg cada lado", "Foco no alongamento"),
    ],
  };
}
