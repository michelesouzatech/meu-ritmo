import { useEffect, useState } from "react";
import * as db from "../lib/db.js";

// Guarda o diário de treino. Mesmo padrão do resto: muda a tela na hora e
// salva no banco atrás.
export function useJournal({ userId, save, initial, pointRules, addPoints, celebratePoints }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!initial) return;
    setEntries(initial);
  }, [initial]);

  function addEntry(data) {
    const entry = { id: crypto.randomUUID(), ...data };
    setEntries((prev) => [...prev, entry]);
    // Dia de descanso é uma escolha deliberada de não treinar — não pontua.
    const earnsPoints = entry.activityType !== "rest";
    if (earnsPoints) {
      addPoints(pointRules.journal_entry || 0);
      celebratePoints(pointRules.journal_entry);
    }
    save(async () => {
      await db.insertJournalEntry(userId, entry);
      if (earnsPoints) {
        await db.awardPoints(userId, "journal_entry", entry.id, pointRules.journal_entry, entry.date);
      }
    });
  }

  function editEntry(id, data) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    save(() => db.updateJournalEntry(id, data));
  }

  function deleteEntry(id) {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (entry && entry.activityType !== "rest") addPoints(-(pointRules.journal_entry || 0));
    save(async () => {
      await db.removeJournalEntry(id);
      await db.revokePoints("journal_entry", id);
    });
  }

  return { entries, addEntry, editEntry, deleteEntry };
}
