import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import CatMascot from "../components/CatMascot.jsx";
import GlassBackdrop from "../components/GlassBackdrop.jsx";

const inputClass = "ritmo-field min-h-11 w-full rounded-xl px-3 text-sm";

// Aparece depois que a pessoa clica no link de "esqueci minha senha" do e-mail —
// o Supabase já loga com uma sessão temporária, e essa tela define a senha nova.
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Não deu pra salvar a senha agora. Tenta de novo em instantes.");
      setLoading(false);
      return;
    }
    onDone();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <GlassBackdrop />
      <CatMascot size={160} className="mb-4 drop-shadow-md" />
      <h1 className="text-xl font-semibold tracking-tight text-ritmo-text">Defina sua senha</h1>
      <p className="mt-2 max-w-xs text-sm text-ritmo-muted">
        Escolhe uma senha nova pra usar daqui pra frente.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Senha nova"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={loading}
          className="ritmo-cta mt-2 flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold"
        >
          {loading ? "Salvando..." : "Salvar senha"}
        </button>
      </form>

      {error && <p className="mt-4 text-xs text-ritmo-pink-deep">{error}</p>}
    </div>
  );
}

export default ResetPasswordScreen;
