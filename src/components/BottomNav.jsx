import { Home, ListChecks, Repeat, Dumbbell, User } from "lucide-react";

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 text-ritmo-text/40 transition-colors hover:text-ritmo-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritmo-pink data-[active=true]:text-ritmo-pink"
      data-active={active}
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </button>
  );
}

const TABS = [
  { id: "home", label: "Início", icon: Home },
  { id: "tasks", label: "Tarefas", icon: ListChecks },
  { id: "habits", label: "Hábitos", icon: Repeat },
  { id: "workout", label: "Treino", icon: Dumbbell },
  { id: "profile", label: "Perfil", icon: User },
];

function BottomNav({ active, onNavigate }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 flex justify-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex w-full max-w-md items-center justify-between border-t border-ritmo-text/5 bg-white/90 px-2 pt-2 backdrop-blur">
        {TABS.map((tab) => (
          <NavItem
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={active === tab.id}
            onClick={() => onNavigate(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
