function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function toHex(n) {
  return Math.round(n).toString(16).padStart(2, "0");
}

export function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamped = Math.min(1, Math.max(0, t));
  const r = a.r + (b.r - a.r) * clamped;
  const g = a.g + (b.g - a.g) * clamped;
  const bChan = a.b + (b.b - a.b) * clamped;
  return `#${toHex(r)}${toHex(g)}${toHex(bChan)}`;
}
