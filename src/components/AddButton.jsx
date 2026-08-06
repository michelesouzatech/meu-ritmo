import { Plus } from "lucide-react";

// A ação principal da tela — é o único rosa cheio que aparece no cabeçalho.
function AddButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ritmo-cta flex min-h-11 items-center gap-1 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritmo-pink"
    >
      <Plus size={16} strokeWidth={2.5} />
      {label}
    </button>
  );
}

export default AddButton;
