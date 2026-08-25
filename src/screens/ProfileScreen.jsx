import { useRef, useState } from "react";
import { ArrowLeft, Camera, LogOut } from "lucide-react";
import CatMascot from "../components/CatMascot.jsx";
import AgendaCard from "../components/AgendaCard.jsx";
import InsightsScreen from "./InsightsScreen.jsx";
import { todayISO } from "../lib/date.js";
import { supabase } from "../lib/supabase.js";

function displayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || "Sem nome";
}

function StatCard({ label, value }) {
  return (
    <div className="ritmo-card rounded-2xl p-4 text-center">
      <p className="text-xl font-semibold text-ritmo-pink-deep">{value}</p>
      <p className="mt-0.5 text-xs text-ritmo-muted">{label}</p>
    </div>
  );
}

function ProfileScreen({
  user,
  tasks,
  habits,
  regras,
  ai,
  calendar,
  onToggleTask,
  onConnectCalendar,
  onRefreshCalendar,
  onOpenEvent,
  onNewEvent,
  onLogout,
  onNavigate,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const doneTasks = tasks.filter((t) => t.done).length;
  const activeHabits = habits.length;
  const today = todayISO();

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setError("Não deu pra trocar a foto agora. Tenta de novo em instantes.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: `${data.publicUrl}?t=${Date.now()}` },
    });

    if (updateError) {
      setError("Foto enviada, mas não deu pra atualizar o perfil. Tenta de novo.");
    }
    setUploading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onNavigate("home")}
        className="mb-4 flex min-h-11 items-center gap-1 rounded-full pr-3 text-sm font-medium text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
      >
        <ArrowLeft size={20} />
        Voltar
      </button>

      <header className="mb-6 flex flex-col items-center text-center">
        <div className="relative">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="h-24 w-24 rounded-full object-cover shadow-md shadow-ritmo-text/10"
            />
          ) : (
            <CatMascot size={120} />
          )}
          <button
            type="button"
            aria-label="Trocar foto"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-ritmo-pink-deep text-white shadow-md shadow-ritmo-text/10 transition-transform active:scale-95 disabled:opacity-60"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
        {uploading && <p className="mt-2 text-xs text-ritmo-muted">Enviando foto...</p>}
        {error && <p className="mt-2 text-xs text-ritmo-pink-deep">{error}</p>}
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-ritmo-text">
          {displayName(user)}
        </h1>
        <p className="mt-0.5 text-sm text-ritmo-muted">{user?.email}</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="tarefas concluídas" value={doneTasks} />
        <StatCard label="hábitos ativos" value={activeHabits} />
      </div>

      <AgendaCard
        status={calendar.status}
        events={calendar.events}
        tasks={tasks}
        focusDate={calendar.focusDate}
        today={today}
        onFocusDate={calendar.setFocusDate}
        onConnect={onConnectCalendar}
        onRefresh={onRefreshCalendar}
        onOpenEvent={onOpenEvent}
        onNewEvent={onNewEvent}
        onToggleTask={onToggleTask}
      />

      <button
        type="button"
        onClick={onLogout}
        className="ritmo-ghost mb-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-ritmo-pink-deep"
      >
        <LogOut size={18} />
        Sair da conta
      </button>

      <InsightsScreen regras={regras} ai={ai} onNavigate={onNavigate} />
    </div>
  );
}

export default ProfileScreen;
