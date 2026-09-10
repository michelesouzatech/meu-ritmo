import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db.js";
import { activePlan as findActivePlan } from "../lib/running.js";

// Guarda provas, plano de treino e corridas feitas. Segue o mesmo padrão do
// resto do app: muda a tela na hora e salva no banco atrás, avisando o App
// pelo `save` quando dá erro.
export function useRunning({ userId, save, initial, pointRules }) {
  const [races, setRaces] = useState([]);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!initial) return;
    setRaces(initial.races);
    setPlans(initial.plans);
    setSessions(initial.sessions);
  }, [initial]);

  const plan = useMemo(() => findActivePlan(plans), [plans]);

  function addRace(data) {
    const race = { id: crypto.randomUUID(), ...data };
    setRaces((prev) => [...prev, race]);
    save(() => db.insertRace(userId, race));
    return race;
  }

  function editRace(id, data) {
    setRaces((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    save(() => db.updateRace(id, data));
  }

  // Apagar a prova não pode levar junto o plano nem o histórico de corridas —
  // o banco desliga o vínculo (on delete set null) e a tela acompanha.
  function deleteRace(id) {
    setRaces((prev) => prev.filter((r) => r.id !== id));
    setPlans((prev) => prev.map((p) => (p.raceId === id ? { ...p, raceId: null } : p)));
    save(() => db.removeRace(id));
  }

  function addPlan(data) {
    const newPlan = { id: crypto.randomUUID(), archived: false, ...data };
    setPlans((prev) => [...prev.map((p) => ({ ...p, archived: true })), newPlan]);
    save(async () => {
      await db.insertRunPlan(userId, newPlan);
      await db.archiveOtherPlans(userId, newPlan.id);
    });
  }

  function editPlan(id, data) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    save(() => db.updateRunPlan(id, data));
  }

  function archivePlan(id) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)));
    save(() => db.updateRunPlan(id, { archived: true }));
  }

  function deletePlan(id) {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setSessions((prev) => prev.map((s) => (s.planId === id ? { ...s, planId: null } : s)));
    save(() => db.removeRunPlan(id));
  }

  // Uma corrida registrada sem plano ativo continua salva — ela só não entra
  // na conta de consistência, porque não há meta pra comparar.
  function addSession(data) {
    const session = { id: crypto.randomUUID(), planId: plan?.id ?? null, ...data };
    setSessions((prev) => [...prev, session]);
    save(async () => {
      await db.insertRunSession(userId, session);
      await db.awardPoints(userId, "run_session", session.id, pointRules.run_session, session.date);
    });
  }

  function editSession(id, data) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    save(() => db.updateRunSession(id, data));
  }

  function deleteSession(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    save(async () => {
      await db.removeRunSession(id);
      await db.revokePoints("run_session", id);
    });
  }

  return {
    races,
    plans,
    sessions,
    plan,
    addRace,
    editRace,
    deleteRace,
    addPlan,
    editPlan,
    archivePlan,
    deletePlan,
    addSession,
    editSession,
    deleteSession,
  };
}
