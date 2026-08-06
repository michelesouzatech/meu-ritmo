import { useEffect, useState } from "react";
import * as db from "../lib/db.js";

// Guarda o diário de treino. Mesmo padrão do resto: muda a tela na hora e
// salva no banco atrás.
export function useJournal({ userId, save, initial }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!initial) return;
    setEntries(initial);
  }, [initial]);

  function addEntry(data) {
    const entry = { id: crypto.randomUUID(), ...data };
    setEntries((prev) => [...prev, entry]);
    save(() => db.insertJournalEntry(userId, entry));
  }

  function editEntry(id, data) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    save(() => db.updateJournalEntry(id, data));
  }

  function deleteEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    save(() => db.removeJournalEntry(id));
  }

  return { entries, addEntry, editEntry, deleteEntry };
}
