import { useState } from "react";
import { Dumbbell, Footprints, NotebookPen } from "lucide-react";
import GymTab from "./GymTab.jsx";
import RunningTab from "./RunningTab.jsx";
import JournalTab from "./JournalTab.jsx";

const TAB_KEY = "meuritmo:workout-tab";

const TABS = [
  { id: "gym", label: "Força", icon: Dumbbell },
  { id: "running", label: "Corrida", icon: Footprints },
  { id: "journal", label: "Diário", icon: NotebookPen },
];

const TAB_IDS = TABS.map((t) => t.id);

// Lembra em qual sub-aba a pessoa estava, igual a agenda já faz com
// semana/mês. Sem localStorage, abre em Força.
function readSavedTab() {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return TAB_IDS.includes(saved) ? saved : "gym";
  } catch {
    return "gym";
  }
}

function SubTabs({ active, onChange }) {
  return (
    <div className="ritmo-inset mb-4 flex rounded-full p-0.5">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors ${
            active === id ? "ritmo-glass-pill text-ritmo-pink-deep" : "text-ritmo-muted"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

function WorkoutScreen({ gym, running, journal }) {
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

      {tab === "gym" && <GymTab {...gym} />}
      {tab === "running" && <RunningTab {...running} />}
      {tab === "journal" && <JournalTab {...journal} />}
    </div>
  );
}

export default WorkoutScreen;
