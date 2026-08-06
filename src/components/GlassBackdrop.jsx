// As manchas de cor que ficam atrás de tudo. O vidro líquido só existe se
// tiver o que desfocar — sem elas os cards translúcidos viram cinza.
// Duas rosas, duas lilases e uma pêssego: nem o fundo é maioria rosa.
// Quanto mais fosco o vidro, mais cor ele precisa por baixo pra ter o que
// frostar — senão o painel leitoso vira cinza. Por isso as manchas são mais
// fortes do que pareceria necessário olhando o fundo sozinho.
const BLOBS = [
  { color: "#ff8ec8", opacity: 0.34, size: 300, top: "-6%", left: "-14%", duration: "26s", delay: "0s" },
  { color: "#c9a6ff", opacity: 0.38, size: 270, top: "26%", right: "-16%", duration: "32s", delay: "-6s" },
  { color: "#ffc2e3", opacity: 0.36, size: 300, bottom: "8%", left: "-12%", duration: "29s", delay: "-12s" },
  { color: "#ffd0b0", opacity: 0.3, size: 220, top: "56%", left: "34%", duration: "35s", delay: "-4s" },
  { color: "#a98cf0", opacity: 0.26, size: 240, bottom: "-8%", right: "-6%", duration: "31s", delay: "-18s" },
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
              animationDuration: blob.duration,
              animationDelay: blob.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default GlassBackdrop;
