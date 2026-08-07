// O que fica atrás de tudo. O vidro líquido só existe se tiver o que
// desfocar — sem nada embaixo os cards translúcidos viram cinza chapado.
//
// Eram cinco manchas em cinco matizes, deslizando o tempo todo. Viraram duas,
// paradas, quase sem cor: o que o vidro precisa é de variação de claridade,
// não de cor. Uma puxa de leve pro rosa do acento, a outra pro frio, e a
// diferença entre elas é o que dá volume ao vidro sem pintar a tela.
const BLOBS = [
  { color: "#f3dfe9", opacity: 0.75, size: 420, top: "-12%", left: "-20%" },
  { color: "#e4e2e8", opacity: 0.7, size: 380, bottom: "-6%", right: "-18%" },
];

function GlassBackdrop() {
  return (
    <div className="ritmo-backdrop" aria-hidden>
      <div className="ritmo-backdrop-inner">
        {BLOBS.map((blob, i) => (
          <div
            key={i}
            className="ritmo-blob"
            style={{
              width: blob.size,
              height: blob.size,
              top: blob.top,
              right: blob.right,
              bottom: blob.bottom,
              left: blob.left,
              backgroundColor: blob.color,
              opacity: blob.opacity,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default GlassBackdrop;
