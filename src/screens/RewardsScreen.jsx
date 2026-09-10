import { useState } from "react";
import { ArrowLeft, Gift, Pencil, Trash2, Undo2, History, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";

export function RewardFormSheet({ reward, onClose, onSave }) {
  const isEditing = !!reward;
  const [name, setName] = useState(reward?.name ?? "");
  const [cost, setCost] = useState(reward?.cost ?? 100);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !cost) return;
    onSave({ name: name.trim(), cost: Number(cost) });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar recompensa" : "Nova recompensa"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">Recompensa</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Um dia de alimentação livre"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Custo em pontos
          </label>
          <input
            type="number"
            min={1}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Criar recompensa"}
        </button>
      </form>
    </Sheet>
  );
}

function RewardCard({ reward, balance, onRedeem, onEdit, onDelete }) {
  const canRedeem = balance >= reward.cost;
  const missing = reward.cost - balance;

  return (
    <div className="ritmo-card rounded-2xl p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ritmo-text">{reward.name}</p>
          <p className="mt-0.5 text-xs text-ritmo-muted">{reward.cost} pontos</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(reward)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            aria-label="Editar recompensa"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(reward.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            aria-label="Excluir recompensa"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <button
        type="button"
        disabled={!canRedeem}
        onClick={() => onRedeem(reward)}
        className={`mt-2.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${
          canRedeem
            ? "ritmo-cta"
            : "ritmo-inset cursor-not-allowed text-ritmo-muted"
        }`}
      >
        {canRedeem ? (
          <>
            <Gift size={15} /> Resgatar
          </>
        ) : (
          `Faltam ${missing} pontos`
        )}
      </button>
    </div>
  );
}

function RedemptionHistory({ redemptions, onUndo }) {
  const [open, setOpen] = useState(false);
  if (redemptions.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ritmo-ghost flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ritmo-ink-soft"
      >
        <History size={13} />
        {open ? "Ocultar" : "Ver"} resgates ({redemptions.length})
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {redemptions.map((r) => (
            <div key={r.id} className="ritmo-card flex items-center gap-3 rounded-2xl p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ritmo-text">{r.rewardName}</p>
                <p className="mt-0.5 text-xs text-ritmo-muted">
                  {r.cost} pontos · {new Date(r.redeemedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUndo(r.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
                aria-label="Desfazer resgate"
              >
                <Undo2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RewardsScreen({
  balance,
  rewards,
  redemptions,
  onAdd,
  onEdit,
  onDelete,
  onRedeem,
  onUndoRedeem,
  onNavigate,
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onNavigate("profile")}
        className="mb-4 flex min-h-11 items-center gap-1 rounded-full pr-3 text-sm font-medium text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
      >
        <ArrowLeft size={20} />
        Voltar
      </button>

      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ritmo-text">Recompensas</h1>

      <section className="ritmo-glass mb-6 flex items-center gap-3 rounded-2xl px-4 py-4">
        <span className="ritmo-glass-pill flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ritmo-pink-deep">
          <Sparkles size={20} />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ritmo-ink-soft">
            Seu saldo
          </p>
          <p className="text-2xl font-semibold text-ritmo-text">{balance} pontos</p>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ritmo-muted">Troque pontos pelo que você mesma cadastrar</p>
        <AddButton label="Nova" onClick={onAdd} />
      </div>

      {rewards.length === 0 ? (
        <p className="ritmo-card rounded-2xl p-4 text-center text-sm text-ritmo-muted">
          Toque no botão + para cadastrar sua primeira recompensa.
        </p>
      ) : (
        <div className="space-y-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              balance={balance}
              onRedeem={onRedeem}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <RedemptionHistory redemptions={redemptions} onUndo={onUndoRedeem} />
    </div>
  );
}

export default RewardsScreen;
