import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import CatMascot from "../components/CatMascot.jsx";

const inputClass =
  "min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink";

function LoginScreen() {
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const isSignUp = mode === "signUp";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message.includes("Invalid login credentials")
          ? "E-mail ou senha errados."
          : "Não deu pra entrar agora. Tenta de novo em instantes.",
      );
    } else if (isSignUp) {
      setInfo("Conta criada! Se pedir confirmação, confira seu e-mail.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ritmo-bg px-6 text-center">
      <CatMascot size={200} className="mb-4 drop-shadow-md" />
      <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">Meu Ritmo</h1>
      <p className="mt-2 max-w-xs text-sm text-ritmo-text/60">
        {isSignUp
          ? "Cria sua conta pra acessar suas tarefas, hábitos, treino, agenda e insights."
          : "Entra com seu e-mail e senha pra acessar suas tarefas, hábitos, treino, agenda e insights."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <input
          type="email"
          autoComplete="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={6}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full bg-ritmo-pink px-4 text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Um instante..." : isSignUp ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isSignUp ? "signIn" : "signUp");
          setError(null);
          setInfo(null);
        }}
        className="mt-4 min-h-11 text-sm font-medium text-ritmo-text/60 underline-offset-2 hover:underline"
      >
        {isSignUp ? "Já tenho conta" : "Criar conta nova"}
      </button>

      {error && <p className="mt-4 text-xs text-ritmo-pink-deep">{error}</p>}
      {info && <p className="mt-4 text-xs text-ritmo-text/60">{info}</p>}
    </div>
  );
}

export default LoginScreen;
