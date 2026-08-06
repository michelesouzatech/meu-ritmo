import { useState } from "react";
import { Dumbbell, Footprints } from "lucide-react";
import GymTab from "./GymTab.jsx";
import RunningTab from "./RunningTab.jsx";

const TAB_KEY = "meuritmo:workout-tab";

// Lembra em qual sub-aba a pessoa estava, igual a agenda já faz com
// semana/mês. Sem localStorage, abre em Musculação.
function readSavedTab() {
  try {
    return localStorage.getItem(TAB_KEY) === "running" ? "running" : "gym";
  } catch {
    return "gym";
  }
}

const TABS = [
  { id: "gym", label: "Musculação", icon: Dumbbell },
  { id: "running", label: "Corrida", icon: Footprints },
];

function SubTabs({ active, onChange }) {
  return (
    <div className="ritmo-inset mb-4 flex rounded-full p-0.5">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
            active === id ? "ritmo-glass-pill text-ritmo-lilac-ink" : "text-ritmo-muted"
          }`}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}

function WorkoutScreen({ gym, running }) {
  const [tab, setTab] = useState(readSavedTab);

  function changeTab(next) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Sem localStorage a aba só volta ao padrão na próxima abertura.
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ritmo-text">Treino</h1>

      <SubTabs active={tab} onChange={changeTab} />

      {tab === "gym" ? <GymTab {...gym} /> : <RunningTab {...running} />}
    </div>
  );
}

export default WorkoutScreen;
