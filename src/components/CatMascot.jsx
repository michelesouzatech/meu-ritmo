function CatMascot({ className = "", size = 200 }) {
  return (
    <img
      src="/mascote.png"
      width={size}
      height={Math.round((size * 530) / 468)}
      alt="Gatinha branca com coleira rosa, mascote do Meu Ritmo"
      className={className}
      style={{ width: size, height: "auto" }}
    />
  );
}

export default CatMascot;
