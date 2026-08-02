import { useRef, useState } from "react";
import { ArrowLeft, Camera, LogOut } from "lucide-react";
import CatMascot from "../components/CatMascot.jsx";
import InsightsScreen from "./InsightsScreen.jsx";
import { supabase } from "../lib/supabase.js";

function displayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || "Sem nome";
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm shadow-ritmo-text/5">
      <p className="text-xl font-semibold text-ritmo-pink-deep">{value}</p>
      <p className="mt-0.5 text-xs text-ritmo-text/50">{label}</p>
    </div>
  );
}

function BodyStatsCard({ user }) {
  const [weight, setWeight] = useState(user?.user_metadata?.weight_kg ?? "");
  const [height, setHeight] = useState(user?.user_metadata?.height_cm ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function saveIfChanged(field, value, original) {
    if (String(value) === String(original ?? "")) return;
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { [field]: value === "" ? null : Number(value) },
    });
    if (updateError) setError("Não deu pra salvar agora. Tenta de novo em instantes.");
    setSaving(false);
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm shadow-ritmo-text/5">
      <p className="mb-3 text-sm font-medium text-ritmo-text">Peso e altura</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ritmo-text/50">
            Peso (kg)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => saveIfChanged("weight_kg", weight, user?.user_metadata?.weight_kg)}
            placeholder="Ex: 62.5"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ritmo-text/50">
            Altura (cm)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onBlur={() => saveIfChanged("height_cm", height, user?.user_metadata?.height_cm)}
            placeholder="Ex: 165"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
      </div>
      {saving && <p className="mt-2 text-xs text-ritmo-text/40">Salvando...</p>}
      {error && <p className="mt-2 text-xs text-ritmo-pink-deep">{error}</p>}
    </div>
  );
}

function ProfileScreen({ user, tasks, habits, workout, bodyFat, calendar, onLogout, onNavigate }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const doneTasks = tasks.filter((t) => t.done).length;
  const activeHabits = habits.length;

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
        className="mb-4 flex min-h-11 items-center gap-1 rounded-full pr-3 text-sm font-medium text-ritmo-text/60 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
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
              className="h-24 w-24 rounded-full object-cover shadow-md shadow-ritmo-pink/30"
            />
          ) : (
            <CatMascot size={120} />
          )}
          <button
            type="button"
            aria-label="Trocar foto"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-ritmo-pink text-white shadow-md shadow-ritmo-pink/40 transition-transform active:scale-95 disabled:opacity-60"
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
        {uploading && <p className="mt-2 text-xs text-ritmo-text/50">Enviando foto...</p>}
        {error && <p className="mt-2 text-xs text-ritmo-pink-deep">{error}</p>}
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-ritmo-text">
          {displayName(user)}
        </h1>
        <p className="mt-0.5 text-sm text-ritmo-text/50">{user?.email}</p>
      </header>

      <BodyStatsCard user={user} />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="tarefas concluídas" value={doneTasks} />
        <StatCard label="hábitos ativos" value={activeHabits} />
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mb-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ritmo-pink-deep shadow-sm shadow-ritmo-text/5 transition-transform active:scale-[0.98]"
      >
        <LogOut size={18} />
        Sair da conta
      </button>

      <InsightsScreen
        tasks={tasks}
        habits={habits}
        workout={workout}
        bodyFat={bodyFat}
        calendar={calendar}
      />
    </div>
  );
}

export default ProfileScreen;
