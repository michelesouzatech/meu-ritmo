import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// Aparece por cima de qualquer tela quando uma ação soma pontos. A entrada
// só troca de opacidade/posição depois do primeiro frame — sem isso o
// navegador já pinta no estado final e a transição não roda.
function PointsToast({ amount }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <span className="ritmo-glass-pill flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-ritmo-pink-deep shadow-md shadow-ritmo-text/10">
        <Sparkles size={16} />
        +{amount} ponto{amount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export default PointsToast;
