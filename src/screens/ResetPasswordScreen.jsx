import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import CatMascot from "../components/CatMascot.jsx";

const inputClass =
  "min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink";

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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ritmo-bg px-6 text-center">
      <CatMascot size={160} className="mb-4 drop-shadow-md" />
      <h1 className="text-xl font-semibold tracking-tight text-ritmo-text">Defina sua senha</h1>
      <p className="mt-2 max-w-xs text-sm text-ritmo-text/60">
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
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full bg-ritmo-pink px-4 text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar senha"}
        </button>
      </form>

      {error && <p className="mt-4 text-xs text-ritmo-pink-deep">{error}</p>}
    </div>
  );
}

export default ResetPasswordScreen;
