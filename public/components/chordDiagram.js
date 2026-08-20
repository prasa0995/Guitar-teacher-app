// Renders a beginner-friendly chord diagram as inline SVG. No music-theory
// knowledge required to read it: dots = fingers, X = don't play, O = open.
export function chordDiagramSVG(chord, { width = 140 } = {}) {
  const strings = 6;
  const frets = 4;
  const height = width * 1.25;
  const marginTop = 26;
  const marginX = 16;
  const gridW = width - marginX * 2;
  const gridH = height - marginTop - 16;
  const stringGap = gridW / (strings - 1);
  const fretGap = gridH / frets;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  // nut or fret-0 marker
  const startFret = Math.min(...chord.frets.filter((f) => f !== null && f > 0), 5);
  const showBarreOffset = startFret > 1 ? startFret - 1 : 0;

  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="none"/>`;
  // strings
  for (let s = 0; s < strings; s++) {
    const x = marginX + s * stringGap;
    svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + gridH}" stroke="#5c6672" stroke-width="1.5"/>`;
  }
  // frets
  for (let f = 0; f <= frets; f++) {
    const y = marginTop + f * fretGap;
    const strokeW = f === 0 && showBarreOffset === 0 ? 4 : 1.5;
    svg += `<line x1="${marginX}" y1="${y}" x2="${marginX + gridW}" y2="${y}" stroke="#5c6672" stroke-width="${strokeW}"/>`;
  }
  if (showBarreOffset > 0) {
    svg += `<text x="${marginX + gridW + 4}" y="${marginTop + fretGap * 0.7}" font-size="10" fill="#9aa5b1">${startFret}fr</text>`;
  }

  // barre
  if (chord.barre) {
    const y = marginTop + fretGap * 0.5;
    const x1 = marginX + chord.barre.fromString * stringGap;
    const x2 = marginX + chord.barre.toString * stringGap;
    svg += `<rect x="${x1 - 6}" y="${y - 6}" width="${x2 - x1 + 12}" height="12" rx="6" fill="#e8a33d"/>`;
  }

  // open/muted markers above nut
  chord.frets.forEach((f, i) => {
    const x = marginX + i * stringGap;
    if (f === null) {
      svg += `<text x="${x}" y="${marginTop - 10}" font-size="13" text-anchor="middle" fill="#e15c5c" font-weight="700">×</text>`;
    } else if (f === 0) {
      svg += `<circle cx="${x}" cy="${marginTop - 13}" r="4" fill="none" stroke="#57b56a" stroke-width="1.5"/>`;
    }
  });

  // finger dots
  chord.frets.forEach((f, i) => {
    if (f && f > 0) {
      const fretIndexOnGrid = showBarreOffset > 0 ? f - showBarreOffset : f;
      const x = marginX + i * stringGap;
      const y = marginTop + (fretIndexOnGrid - 0.5) * fretGap;
      const finger = chord.fingers ? chord.fingers[i] : '';
      svg += `<circle cx="${x}" cy="${y}" r="9" fill="#e8a33d"/>`;
      if (finger) svg += `<text x="${x}" y="${y + 4}" font-size="10" text-anchor="middle" fill="#1a1305" font-weight="700">${finger}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}
