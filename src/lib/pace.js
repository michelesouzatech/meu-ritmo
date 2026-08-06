// Tempo e pace vivem em segundos no banco — só assim dá pra comparar "meta
// 6:00" com "fiz 6:12" e dizer quantos segundos faltaram. Aqui ficam as
// conversões de e pra mm:ss, que é como a pessoa digita e lê.

// Aceita "31:12" (mm:ss), "1:05:30" (h:mm:ss) e "45" (minutos secos, que é
// como se fala uma corrida leve).
export function parseDuration(raw) {
  const text = String(raw ?? "").trim().replace(",", ":");
  if (!text) return null;

  const parts = text.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;

  const numbers = parts.map(Number);
  if (numbers.length === 1) return numbers[0] * 60;
  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds > 59) return null;
    return minutes * 60 + seconds;
  }
  if (numbers.length === 3) {
    const [hours, minutes, seconds] = numbers;
    if (minutes > 59 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}

export function formatDuration(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "";
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// Pace é sempre mm:ss por km — nunca passa de uma hora por quilômetro.
export function parsePace(raw) {
  const seconds = parseDuration(raw);
  if (seconds == null || seconds <= 0 || seconds >= 3600) return null;
  return seconds;
}

export function formatPace(secondsPerKm) {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm)) return "";
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatPaceLabel(secondsPerKm) {
  const text = formatPace(secondsPerKm);
  return text ? `${text}/km` : "";
}

// O pace sai da conta, não do dedo: a pessoa digita distância e tempo.
export function paceFrom(distanceKm, durationSeconds) {
  if (!distanceKm || !durationSeconds) return null;
  if (distanceKm <= 0 || durationSeconds <= 0) return null;
  return durationSeconds / distanceKm;
}

export function parseDistance(raw) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

// Duas casas bastam e ninguém diz "21,098 km" — o banco guarda 3 casas, mas
// aqui a meia-maratona vira "21,1 km", que é como se fala.
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return "";
  const rounded = Math.round(km * 100) / 100;
  return `${String(rounded).replace(".", ",")} km`;
}

// "6:12 contra a meta de 6:00" vira "12s/km acima da meta".
export function paceGap(actualSeconds, goalSeconds) {
  if (actualSeconds == null || goalSeconds == null) return null;
  const diff = Math.round(actualSeconds - goalSeconds);
  if (diff === 0) return { diff: 0, text: "na meta exata" };
  const seconds = Math.abs(diff);
  const label = seconds === 1 ? "1s/km" : `${seconds}s/km`;
  return { diff, text: diff < 0 ? `${label} abaixo da meta` : `${label} acima da meta` };
}
