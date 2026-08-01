import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HEADER_KEYWORDS = [
  { col: "name", keywords: ["exerc"] },
  { col: "setsReps", keywords: ["série", "serie", "reps", "repeti"] },
  { col: "weight", keywords: ["carga", "peso"] },
  { col: "notes", keywords: ["observ"] },
];

function classifyHeaderCell(text) {
  const t = text.toLowerCase();
  const match = HEADER_KEYWORDS.find(({ keywords }) =>
    keywords.some((k) => t.includes(k)),
  );
  return match?.col ?? null;
}

async function extractLines(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = [];

    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = item.transform[5];
      const x = item.transform[4];
      let row = byY.find((r) => Math.abs(r.y - y) <= 3);
      if (!row) {
        row = { y, items: [] };
        byY.push(row);
      }
      row.items.push({ x, str: item.str });
    }

    byY.sort((a, b) => b.y - a.y);
    for (const row of byY) {
      lines.push(row.items.sort((a, b) => a.x - b.x));
    }
  }

  return lines;
}

function linesToGroups(lines) {
  const groups = [];
  let currentGroup = null;
  let columns = null;

  for (const items of lines) {
    const text = items.map((i) => i.str).join(" ").trim();
    if (!text) continue;

    const headerCols = items
      .map((i) => ({ x: i.x, col: classifyHeaderCell(i.str) }))
      .filter((c) => c.col);

    if (headerCols.length >= 3) {
      columns = headerCols.sort((a, b) => a.x - b.x);
      continue;
    }

    if (!columns) {
      currentGroup = { title: text, rows: [] };
      groups.push(currentGroup);
      continue;
    }

    const cells = { name: "", setsReps: "", weight: "", notes: "" };
    for (const item of items) {
      let nearest = columns[0];
      for (const c of columns) {
        if (Math.abs(c.x - item.x) < Math.abs(nearest.x - item.x)) nearest = c;
      }
      cells[nearest.col] = cells[nearest.col]
        ? `${cells[nearest.col]} ${item.str}`
        : item.str;
    }

    if (!cells.name.trim()) {
      currentGroup = { title: text, rows: [] };
      groups.push(currentGroup);
      columns = null;
      continue;
    }

    currentGroup?.rows.push({
      name: cells.name.trim(),
      setsReps: cells.setsReps.trim(),
      weight: cells.weight.trim() === "-" ? "" : cells.weight.trim(),
      notes: cells.notes.trim(),
    });
  }

  return groups.filter((g) => g.rows.length > 0);
}

export async function extractWorkoutFromPdf(file) {
  const lines = await extractLines(file);
  return linesToGroups(lines);
}
