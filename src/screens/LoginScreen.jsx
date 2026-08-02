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
  const isForgot = mode === "forgot";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setError("Não deu pra enviar o link agora. Tenta de novo em instantes.");
      } else {
        setInfo("Se esse e-mail tiver conta, chega um link pra você definir a senha nova.");
      }
      setLoading(false);
      return;
    }

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
        {isForgot
          ? "Digita seu e-mail pra receber um link e definir uma senha nova."
          : isSignUp
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
        {!isForgot && (
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
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full bg-ritmo-pink px-4 text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading
            ? "Um instante..."
            : isForgot
              ? "Enviar link"
              : isSignUp
                ? "Criar conta"
                : "Entrar"}
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {!isForgot && (
          <button
            type="button"
            onClick={() => {
              setMode(isSignUp ? "signIn" : "signUp");
              setError(null);
              setInfo(null);
            }}
            className="min-h-11 text-sm font-medium text-ritmo-text/60 underline-offset-2 hover:underline"
          >
            {isSignUp ? "Já tenho conta" : "Criar conta nova"}
          </button>
        )}
        {mode !== "signUp" && (
          <button
            type="button"
            onClick={() => {
              setMode(isForgot ? "signIn" : "forgot");
              setError(null);
              setInfo(null);
            }}
            className="min-h-11 text-sm font-medium text-ritmo-text/60 underline-offset-2 hover:underline"
          >
            {isForgot ? "Voltar pro login" : "Esqueci minha senha"}
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-xs text-ritmo-pink-deep">{error}</p>}
      {info && <p className="mt-4 text-xs text-ritmo-text/60">{info}</p>}
    </div>
  );
}

export default LoginScreen;
