import { Plus } from "lucide-react";

function AddButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-1 rounded-full bg-ritmo-pink-light/70 py-2 pl-2.5 pr-3 text-sm font-medium text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritmo-pink"
    >
      <Plus size={16} strokeWidth={2.5} />
      {label}
    </button>
  );
}

export default AddButton;
