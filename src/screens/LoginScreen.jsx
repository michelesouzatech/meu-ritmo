import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { CALENDAR_SCOPE } from "../lib/googleCalendar.js";
import CatMascot from "../components/CatMascot.jsx";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.5 0 10.4-1.8 14.3-5l-6.6-5.4C29.6 36.6 27 37.5 24 37.5c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.6 40.6 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.6 5l6.6 5.4C41.9 35.2 45 30 45 24c0-1.4-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    // Já pede a agenda aqui: se a pessoa autorizar, a tela inicial abre com os
    // compromissos do dia sem precisar de um segundo passo.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: CALENDAR_SCOPE,
        queryParams: { include_granted_scopes: "true" },
      },
    });
    if (error) {
      setError("Não deu pra entrar agora. Tenta de novo em instantes.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ritmo-bg px-6 text-center">
      <CatMascot size={200} className="mb-4 drop-shadow-md" />
      <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">Meu Ritmo</h1>
      <p className="mt-2 max-w-xs text-sm text-ritmo-text/60">
        Entre com sua conta Google pra acessar suas tarefas, hábitos, treino, agenda e insights.
      </p>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="mt-8 flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ritmo-text shadow-md shadow-ritmo-text/10 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Abrindo o Google..." : "Entrar com Google"}
      </button>

      {error && <p className="mt-4 text-xs text-ritmo-pink-deep">{error}</p>}
    </div>
  );
}

export default LoginScreen;
