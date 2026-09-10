import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "./components/BottomNav.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import TasksScreen, { TaskFormSheet } from "./screens/TasksScreen.jsx";
import HabitsScreen, { HabitFormSheet } from "./screens/HabitsScreen.jsx";
import WorkoutScreen from "./screens/WorkoutScreen.jsx";
import {
  ExerciseFormSheet,
  CargaSheet,
  BodyFatFormSheet,
  ImportReviewSheet,
} from "./screens/GymTab.jsx";
import {
  RaceFormSheet,
  RunPlanFormSheet,
  RunSessionFormSheet,
} from "./screens/runSheets.jsx";
import { JournalEntryFormSheet } from "./screens/journalSheets.jsx";
import { SupplementFormSheet } from "./screens/SupplementsTab.jsx";
import RewardsScreen, { RewardFormSheet } from "./screens/RewardsScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import ResetPasswordScreen from "./screens/ResetPasswordScreen.jsx";
import CatMascot from "./components/CatMascot.jsx";
import PointsToast from "./components/PointsToast.jsx";
import GlassBackdrop from "./components/GlassBackdrop.jsx";
import EventFormSheet from "./components/EventFormSheet.jsx";
import { todayISO } from "./lib/date.js";
import { buildInitialWorkoutSeed } from "./lib/seedWorkout.js";
import { supabase } from "./lib/supabase.js";
import { clearGoogleToken, connectGoogleCalendar } from "./lib/googleCalendar.js";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar.js";
import { useRunning } from "./hooks/useRunning.js";
import { useJournal } from "./hooks/useJournal.js";
import { useSaveQueue } from "./hooks/useSaveQueue.js";
import { buildInsights } from "./lib/insights.js";
import * as db from "./lib/db.js";

const emptyWorkout = { createdAt: null, photoName: null, photoDataUrl: null, exercises: [] };
const LOCAL_PREFIX = "meuritmo:";
const SEED_FLAG_KEY = "meuritmo:seeded-workout-v1";
// Mesmo limiar do useGoogleCalendar.js: não busca de novo se os dados têm
// menos de 5 minutos, pra não recarregar tudo a cada troca rápida de aba.
const STALE_MS = 5 * 60 * 1000;

// Lê o que tinha ficado salvo no navegador, na época antes do banco de dados.
function readLocal(key, fallback) {
  try {
    const stored = window.localStorage.getItem(LOCAL_PREFIX + key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [session, setSession] = useState(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [tab, setTab] = useState("home");
  const [workoutTab, setWorkoutTab] = useState(null);
  const [sheet, setSheet] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [workoutId, setWorkoutId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [workout, setWorkout] = useState(emptyWorkout);
  const [bodyFat, setBodyFat] = useState([]);
  const [runningData, setRunningData] = useState(null);
  const [journalData, setJournalData] = useState(null);
  const [journalDate, setJournalDate] = useState(todayISO);
  const [pointRules, setPointRules] = useState({});
  const [pointsEarned, setPointsEarned] = useState(0);
  const [pointsSpent, setPointsSpent] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const pointsBalance = pointsEarned - pointsSpent;

  // Soma direto no total em memória — a mesma escrita otimista que já
  // acontece pro resto (marca hábito, conclui tarefa) valeria pouco se o
  // saldo só atualizasse minutos depois, no próximo refetch.
  const addPoints = useCallback((delta) => setPointsEarned((p) => p + delta), []);

  const [pointsToast, setPointsToast] = useState(null);
  const toastTimerRef = useRef(null);
  const toastIdRef = useRef(0);

  // Só comemora quem ganhou pontos — desmarcar algo não mostra nada.
  const celebratePoints = useCallback((amount) => {
    if (!amount) return;
    toastIdRef.current += 1;
    setPointsToast({ amount, id: toastIdRef.current });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setPointsToast(null), 1600);
  }, []);

  // Guarda a lista atual pra calcular posições sem depender do render.
  const exercisesRef = useRef([]);
  exercisesRef.current = workout.exercises;
  const habitsRef = useRef([]);
  habitsRef.current = habits;
  const supplementsRef = useRef([]);
  supplementsRef.current = supplements;

  // Marca quando os dados vieram do banco pela última vez — usado pra decidir
  // se vale buscar de novo quando o app volta pra frente (ver efeito abaixo).
  const fetchedAtRef = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;
  const calendar = useGoogleCalendar(session);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function start() {
      setLoading(true);
      try {
        let data = await db.loadAll(userId);
        const cloudIsEmpty =
          data.tasks.length === 0 &&
          data.habits.length === 0 &&
          data.workout.exercises.length === 0 &&
          data.bodyFat.length === 0;

        if (cloudIsEmpty) {
          const local = {
            tasks: readLocal("tasks", []),
            habits: readLocal("habits", []),
            workout: readLocal("workout", emptyWorkout),
            bodyFat: readLocal("bodyFat", []),
          };
          const hasLocal =
            local.tasks.length > 0 ||
            local.habits.length > 0 ||
            local.workout.exercises.length > 0 ||
            local.bodyFat.length > 0;

          if (hasLocal) {
            // Primeira vez com banco: leva pra nuvem o que já estava no navegador.
            await db.uploadLocalData(userId, data.workoutId, local);
            data = await db.loadAll(userId);
          } else if (!localStorage.getItem(SEED_FLAG_KEY)) {
            localStorage.setItem(SEED_FLAG_KEY, "1");
            const seed = buildInitialWorkoutSeed();
            await db.replaceExercises(userId, data.workoutId, seed.exercises, seed.createdAt);
            data = await db.loadAll(userId);
          }
        }

        if (cancelled) return;
        setWorkoutId(data.workoutId);
        setTasks(data.tasks);
        setHabits(data.habits);
        setSupplements(data.supplements);
        setWorkout(data.workout);
        setBodyFat(data.bodyFat);
        setRunningData(data.running);
        setJournalData(data.journal);
        setPointRules(data.pointRules);
        setPointsEarned(data.pointsEarned);
        setPointsSpent(data.pointsSpent);
        setRewards(data.rewards);
        setRedemptions(data.redemptions);
        setLoadError(false);
        fetchedAtRef.current = Date.now();
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Salva no banco em segundo plano. A fila insiste sozinha até o banco
  // confirmar — uma internet que pisca não pode levar embora um registro que
  // já apareceu na tela.
  const { save, pending: pendingSaves, failing: saveFailing } = useSaveQueue();

  const running = useRunning({ userId, save, initial: runningData, pointRules, addPoints, celebratePoints });
  const journal = useJournal({ userId, save, initial: journalData, pointRules, addPoints, celebratePoints });

  // Voltou pro app depois de um tempo: busca os dados de novo, do mesmo jeito
  // que a Google Agenda já faz (useGoogleCalendar.js). Sem isso, quem registra
  // algo no celular e volta pro computador com a aba antiga aberta (ou o
  // contrário) via o app parado no que tinha na hora do login — os insights
  // pareciam "não atualizar" porque o motor de regras estava correto, só que
  // trabalhando em cima de um state que nunca era atualizado de novo.
  //
  // Só busca se não há gravação pendente: senão o retorno do banco pode
  // chegar antes da escrita otimista ter sido confirmada e apagar da tela o
  // que a pessoa acabou de marcar.
  useEffect(() => {
    if (!userId) return;
    async function refreshFromCloud() {
      try {
        const data = await db.loadAll(userId);
        setTasks(data.tasks);
        setHabits(data.habits);
        setSupplements(data.supplements);
        setWorkout(data.workout);
        setBodyFat(data.bodyFat);
        setRunningData(data.running);
        setJournalData(data.journal);
        setPointRules(data.pointRules);
        setPointsEarned(data.pointsEarned);
        setPointsSpent(data.pointsSpent);
        setRewards(data.rewards);
        setRedemptions(data.redemptions);
        fetchedAtRef.current = Date.now();
      } catch {
        // Sem sorte agora: os dados na tela continuam sendo os últimos bons,
        // e a próxima vez que o app voltar pra frente tenta de novo.
      }
    }
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAtRef.current < STALE_MS) return;
      if (pendingSaves > 0) return;
      refreshFromCloud();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, pendingSaves]);

  // Os insights são calculados uma vez aqui em cima e distribuídos pras abas,
  // não recalculados em cada tela. As áreas se cruzam — o dia de treino
  // explica o hábito que caiu, a agenda cheia explica a tarefa encalhada — e
  // só o App enxerga todas ao mesmo tempo.
  const insightData = useMemo(
    () => ({
      tasks,
      habits,
      supplements,
      workout,
      bodyFat,
      running: { races: running.races, plan: running.plan, sessions: running.sessions },
      journal: journal.entries,
      events: calendar.events,
      calendarConnected: calendar.status === "ready",
    }),
    [
      tasks,
      habits,
      supplements,
      workout,
      bodyFat,
      running.races,
      running.plan,
      running.sessions,
      journal.entries,
      calendar.events,
      calendar.status,
    ],
  );

  const regras = useMemo(() => buildInsights(insightData), [insightData]);

  // A navegação carrega a sub-aba junto porque as ações sugeridas no Perfil
  // apontam pra dentro da aba Treino. Pelo menu de baixo ela vem nula, e a
  // tela volta a abrir na sub-aba que a pessoa tinha deixado.
  const navigate = useCallback((nextTab, sub = null) => {
    setTab(nextTab);
    setWorkoutTab(sub);
  }, []);

  function addTask(data) {
    const task = { id: crypto.randomUUID(), done: false, ...data };
    setTasks((prev) => [...prev, task]);
    save(() => db.insertTask(userId, task));
  }

  function toggleTask(id) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const done = !current.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    addPoints((done ? 1 : -1) * (pointRules.task_done || 0));
    if (done) celebratePoints(pointRules.task_done);
    save(async () => {
      await db.updateTask(id, { done });
      if (done) {
        await db.awardPoints(userId, "task_done", id, pointRules.task_done, todayISO());
      } else {
        await db.revokePoints("task_done", id);
      }
    });
  }

  function editTask(id, data) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    save(() => db.updateTask(id, data));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    save(() => db.removeTask(id));
  }

  function addHabit(data) {
    const habit = { id: crypto.randomUUID(), ...data };
    const position = habitsRef.current.length;
    setHabits((prev) => [...prev, habit]);
    save(() => db.insertHabit(userId, habit, position));
  }

  function editHabit(id, data) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...data } : h)));
    save(() => db.updateHabit(id, data));
  }

  // orderedIds só cobre os hábitos ativos (é só o que dá pra arrastar na
  // tela) — os encerrados continuam no estado, fora da reordenação.
  function reorderHabits(orderedIds) {
    const byId = new Map(habitsRef.current.map((h) => [h.id, h]));
    const reorderedActive = orderedIds.map((id) => byId.get(id));
    const untouched = habitsRef.current.filter((h) => !orderedIds.includes(h.id));
    setHabits([...reorderedActive, ...untouched]);
    const pairs = reorderedActive.map((h, position) => ({ id: h.id, position }));
    save(() => db.saveHabitPositions(pairs));
  }

  function toggleHabitDate(id, date) {
    const current = habits.find((h) => h.id === id);
    if (!current) return;
    const wasDone = current.completions.includes(date);

    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              completions: wasDone
                ? h.completions.filter((d) => d !== date)
                : [...h.completions, date],
            }
          : h,
      ),
    );
    addPoints((wasDone ? -1 : 1) * (pointRules.habit_completion || 0));
    if (!wasDone) celebratePoints(pointRules.habit_completion);
    save(async () => {
      if (wasDone) {
        await db.removeCompletion(id, date);
        await db.revokePoints("habit_completion", `${id}:${date}`);
      } else {
        await db.insertCompletion(userId, id, date);
        await db.awardPoints(userId, "habit_completion", `${id}:${date}`, pointRules.habit_completion, date);
      }
    });
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    save(() => db.removeHabit(id));
  }

  function finishHabit(id) {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, status: "finished", endedAt: new Date().toISOString() } : h,
      ),
    );
    save(() => db.finishHabit(id));
  }

  function reactivateHabit(id) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: "active", endedAt: null } : h)),
    );
    save(() => db.reactivateHabit(id));
  }

  function addSupplement(data) {
    const supplement = { id: crypto.randomUUID(), ...data };
    const position = supplementsRef.current.length;
    setSupplements((prev) => [...prev, supplement]);
    save(() => db.insertSupplement(userId, supplement, position));
  }

  function editSupplement(id, data) {
    setSupplements((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    save(() => db.updateSupplement(id, data));
  }

  function deleteSupplement(id) {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
    save(() => db.removeSupplement(id));
  }

  function finishSupplement(id) {
    setSupplements((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, active: false, endedAt: new Date().toISOString() } : s,
      ),
    );
    save(() => db.finishSupplement(id));
  }

  function reactivateSupplement(id) {
    setSupplements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: true, endedAt: null } : s)),
    );
    save(() => db.reactivateSupplement(id));
  }

  function addReward(data) {
    const reward = { id: crypto.randomUUID(), ...data };
    setRewards((prev) => [...prev, reward]);
    save(() => db.insertReward(userId, reward));
  }

  function editReward(id, data) {
    setRewards((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    save(() => db.updateReward(id, data));
  }

  function deleteReward(id) {
    setRewards((prev) => prev.filter((r) => r.id !== id));
    save(() => db.removeReward(id));
  }

  function redeemReward(reward) {
    if (pointsBalance < reward.cost) return;
    const redemption = {
      id: crypto.randomUUID(),
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
      redeemedAt: new Date().toISOString(),
    };
    setRedemptions((prev) => [redemption, ...prev]);
    setPointsSpent((p) => p + reward.cost);
    save(() => db.redeemReward(userId, redemption));
  }

  function undoRedemption(id) {
    const redemption = redemptions.find((r) => r.id === id);
    if (!redemption) return;
    setRedemptions((prev) => prev.filter((r) => r.id !== id));
    setPointsSpent((p) => p - redemption.cost);
    save(() => db.removeRedemption(id));
  }

  function toggleSupplementDate(id, date) {
    const current = supplements.find((s) => s.id === id);
    if (!current) return;
    const wasTaken = current.takenDates.includes(date);

    setSupplements((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              takenDates: wasTaken
                ? s.takenDates.filter((d) => d !== date)
                : [...s.takenDates, date],
            }
          : s,
      ),
    );
    addPoints((wasTaken ? -1 : 1) * (pointRules.supplement_log || 0));
    if (!wasTaken) celebratePoints(pointRules.supplement_log);
    save(async () => {
      if (wasTaken) {
        await db.removeSupplementLog(id, date);
        await db.revokePoints("supplement_log", `${id}:${date}`);
      } else {
        await db.insertSupplementLog(userId, id, date);
        await db.awardPoints(userId, "supplement_log", `${id}:${date}`, pointRules.supplement_log, date);
      }
    });
  }

  function addExercise(data) {
    const exercise = { id: crypto.randomUUID(), cargaLogs: [], ...data };
    const position = exercisesRef.current.length;
    const isFirst = workout.createdAt === null;
    const startedOn = isFirst ? todayISO() : workout.createdAt;

    setWorkout((prev) => ({
      ...prev,
      createdAt: prev.createdAt ?? startedOn,
      exercises: [...prev.exercises, exercise],
    }));
    save(async () => {
      await db.insertExercise(userId, workoutId, exercise, position);
      if (isFirst) await db.setWorkoutStartedOn(workoutId, startedOn);
    });
  }

  function updateExercise(id, data) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => (e.id === id ? { ...e, ...data } : e)),
    }));
    save(() => db.updateExercise(id, data));
  }

  function deleteExercise(id) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
    }));
    save(() => db.removeExercise(id));
  }

  function reorderExercises(group, orderedIds) {
    const byId = new Map(exercisesRef.current.map((e) => [e.id, e]));
    const reordered = orderedIds.map((id) => byId.get(id));
    let i = 0;
    const nextExercises = exercisesRef.current.map((e) =>
      e.group === group ? reordered[i++] : e,
    );

    setWorkout((prev) => ({ ...prev, exercises: nextExercises }));
    // Só as posições dos exercícios dessa ficha mudaram de lugar.
    const pairs = nextExercises
      .map((e, position) => ({ id: e.id, position, group: e.group }))
      .filter((p) => p.group === group)
      .map(({ id, position }) => ({ id, position }));
    save(() => db.saveExercisePositions(pairs));
  }

  function addCargaLog(exerciseId, data) {
    const log = { id: crypto.randomUUID(), ...data };
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id === exerciseId ? { ...e, cargaLogs: [...e.cargaLogs, log] } : e,
      ),
    }));
    save(() => db.insertCargaLog(userId, exerciseId, log));
  }

  function deleteCargaLog(exerciseId, logId) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id === exerciseId
          ? { ...e, cargaLogs: e.cargaLogs.filter((l) => l.id !== logId) }
          : e,
      ),
    }));
    save(() => db.removeCargaLog(logId));
  }

  function importParsedWorkout(parsedGroups) {
    const startedOn = todayISO();
    const newExercises = parsedGroups.flatMap((group) =>
      group.rows.map((row) => ({
        id: crypto.randomUUID(),
        group: group.title,
        name: row.name,
        setsReps: row.setsReps,
        notes: "",
        cargaLogs: row.weight
          ? [{ id: crypto.randomUUID(), date: startedOn, weight: row.weight }]
          : [],
      })),
    );

    setWorkout((prev) => ({ ...prev, createdAt: startedOn, exercises: newExercises }));
    save(() => db.replaceExercises(userId, workoutId, newExercises, startedOn));
  }

  function setWorkoutPhoto(photo) {
    if (!photo) {
      setWorkout((prev) => ({ ...prev, photoName: null, photoDataUrl: null }));
      save(() => db.clearWorkoutPhoto(workoutId));
      return;
    }
    // Mostra na hora o arquivo local e troca pelo link do banco quando subir.
    setWorkout((prev) => ({ ...prev, photoName: photo.name, photoDataUrl: photo.dataUrl }));
    save(async () => {
      const url = await db.uploadWorkoutPhoto(userId, workoutId, photo);
      setWorkout((prev) =>
        prev.photoName === photo.name ? { ...prev, photoDataUrl: url } : prev,
      );
    });
  }

  function startNewWorkoutCycle() {
    const startedOn = todayISO();
    setWorkout((prev) => ({ ...prev, createdAt: startedOn }));
    save(() => db.setWorkoutStartedOn(workoutId, startedOn));
  }

  function addBodyFat(data) {
    const entry = { id: crypto.randomUUID(), ...data };
    setBodyFat((prev) => [...prev, entry]);
    save(() => db.insertBodyFat(userId, entry));
  }

  function deleteBodyFat(id) {
    setBodyFat((prev) => prev.filter((b) => b.id !== id));
    save(() => db.removeBodyFat(id));
  }

  // Se o compromisso foi criado/movido pra outro dia, a agenda vai junto —
  // senão parece que nada aconteceu.
  async function createCalendarEvent(form) {
    await calendar.createEvent(form);
    calendar.setFocusDate(form.dateISO);
  }

  async function updateCalendarEvent(ref, form) {
    await calendar.updateEvent(ref, form);
    calendar.setFocusDate(form.dateISO);
  }

  // A prova só vai pra agenda quando ela pede. Guardamos o id do compromisso
  // pra não criar duplicado se ela tocar de novo.
  async function addRaceToCalendar(race) {
    const startTime = race.time || "07:00";
    const endHour = Math.min(23, Number(startTime.slice(0, 2)) + 2);
    const created = await calendar.createEvent({
      title: race.name,
      dateISO: race.date,
      allDay: false,
      startTime,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
      location: race.location,
      days: 1,
      endDayOffset: 0,
    });
    if (created?.id) running.editRace(race.id, { calendarEventId: created.id });
    calendar.setFocusDate(race.date);
  }

  function handleLogout() {
    clearGoogleToken();
    supabase.auth.signOut();
  }

  if (session === undefined) {
    return <div className="min-h-dvh bg-ritmo-bg" />;
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />;
  }

  if (session === null) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <GlassBackdrop />
        <CatMascot size={120} className="animate-pulse" />
        <p className="text-sm text-ritmo-muted">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex justify-center">
      <GlassBackdrop />
      {pointsToast && <PointsToast key={pointsToast.id} amount={pointsToast.amount} />}
      <div className="w-full max-w-md px-5 pt-8 pb-28">
        {loadError && (
          <div className="ritmo-card mb-4 rounded-xl px-3 py-2 text-xs text-ritmo-text">
            <span className="font-semibold text-ritmo-pink-deep">Atenção:</span> não
            deu pra buscar seus dados agora. Confira sua internet e abra o app de
            novo.
          </div>
        )}

        {/* Fica na tela enquanto a gravação não passa: o aviso some quando o
            banco confirma, não quando outra coisa qualquer salva. */}
        {saveFailing && (
          <div className="ritmo-card mb-4 rounded-xl px-3 py-2 text-xs text-ritmo-text">
            <span className="font-semibold text-ritmo-pink-deep">Atenção:</span> não
            deu pra salvar na nuvem agora ({pendingSaves}{" "}
            {pendingSaves === 1 ? "alteração esperando" : "alterações esperando"}).
            Estamos tentando de novo sozinhos — deixe o app aberto até esse aviso
            sumir.
          </div>
        )}

        {tab === "home" && (
          <HomeScreen
            tasks={tasks}
            habits={habits}
            user={session.user}
            calendar={calendar}
            running={running}
            pointsBalance={pointsBalance}
            rewards={rewards}
            onToggleTask={toggleTask}
            onNavigate={navigate}
          />
        )}
        {tab === "tasks" && (
          <TasksScreen
            tasks={tasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEdit={(task) => setSheet({ type: "editTask", task })}
            onAdd={() => setSheet("task")}
          />
        )}
        {tab === "habits" && (
          <HabitsScreen
            habits={habits}
            onToggleDate={toggleHabitDate}
            onDelete={deleteHabit}
            onFinish={finishHabit}
            onReactivate={reactivateHabit}
            onEdit={(habit) => setSheet({ type: "editHabit", habit })}
            onReorder={reorderHabits}
            onAdd={() => setSheet("habit")}
            supplements={supplements}
            onToggleSupplementDate={toggleSupplementDate}
            onDeleteSupplement={deleteSupplement}
            onFinishSupplement={finishSupplement}
            onReactivateSupplement={reactivateSupplement}
            onEditSupplement={(supplement) => setSheet({ type: "editSupplement", supplement })}
            onAddSupplement={() => setSheet("supplement")}
          />
        )}
        {tab === "workout" && (
          <WorkoutScreen
            initialTab={workoutTab}
            gym={{
              workout,
              bodyFat,
              journal: journal.entries,
              onAddExercise: () => setSheet("exercise"),
              onUpdateExercise: updateExercise,
              onDeleteExercise: deleteExercise,
              onOpenCarga: (exerciseId) => setSheet({ type: "carga", exerciseId }),
              onSetPhoto: setWorkoutPhoto,
              onNewCycle: startNewWorkoutCycle,
              onAddBodyFat: () => setSheet("bodyfat"),
              onDeleteBodyFat: deleteBodyFat,
              onImportParsed: (groups) => setSheet({ type: "import", groups }),
              onReorderExercises: reorderExercises,
            }}
            running={{
              races: running.races,
              plan: running.plan,
              sessions: running.sessions,
              calendarReady: calendar.status === "ready",
              onAddRace: () => setSheet({ type: "race", race: null }),
              onEditRace: (race) => setSheet({ type: "race", race }),
              onDeleteRace: running.deleteRace,
              onAddToCalendar: addRaceToCalendar,
              onAddPlan: () => setSheet({ type: "runPlan", plan: null }),
              onEditPlan: (plan) => setSheet({ type: "runPlan", plan }),
              onArchivePlan: running.archivePlan,
              onAddSession: (dateISO) =>
                setSheet({ type: "runSession", session: null, dateISO }),
              onEditSession: (session) => setSheet({ type: "runSession", session }),
              onDeleteSession: running.deleteSession,
            }}
            journal={{
              entries: journal.entries,
              selectedDate: journalDate,
              onSelectDate: setJournalDate,
              onAdd: (dateISO) =>
                setSheet({ type: "journal", entry: null, dateISO }),
              onEdit: (entry) => setSheet({ type: "journal", entry }),
              onDelete: journal.deleteEntry,
            }}
          />
        )}
        {tab === "profile" && (
          <ProfileScreen
            user={session.user}
            tasks={tasks}
            habits={habits}
            regras={regras}
            calendar={calendar}
            pointsBalance={pointsBalance}
            onToggleTask={toggleTask}
            onConnectCalendar={connectGoogleCalendar}
            onRefreshCalendar={calendar.refresh}
            onOpenEvent={(event) => setSheet({ type: "event", event })}
            onNewEvent={(dateISO, startTime) =>
              setSheet({ type: "event", event: null, dateISO, startTime })
            }
            onLogout={handleLogout}
            onNavigate={navigate}
          />
        )}
        {tab === "rewards" && (
          <RewardsScreen
            balance={pointsBalance}
            rewards={rewards}
            redemptions={redemptions}
            onAdd={() => setSheet("reward")}
            onEdit={(reward) => setSheet({ type: "editReward", reward })}
            onDelete={deleteReward}
            onRedeem={redeemReward}
            onUndoRedeem={undoRedemption}
            onNavigate={navigate}
          />
        )}
      </div>

      <BottomNav active={tab} onNavigate={navigate} />

      {sheet === "task" && (
        <TaskFormSheet onClose={() => setSheet(null)} onSave={addTask} />
      )}
      {sheet?.type === "editTask" && (
        <TaskFormSheet
          task={sheet.task}
          onClose={() => setSheet(null)}
          onSave={(data) => editTask(sheet.task.id, data)}
        />
      )}
      {sheet === "habit" && (
        <HabitFormSheet onClose={() => setSheet(null)} onSave={addHabit} />
      )}
      {sheet?.type === "editHabit" && (
        <HabitFormSheet
          habit={sheet.habit}
          onClose={() => setSheet(null)}
          onSave={(data) => editHabit(sheet.habit.id, data)}
        />
      )}
      {sheet === "supplement" && (
        <SupplementFormSheet onClose={() => setSheet(null)} onSave={addSupplement} />
      )}
      {sheet?.type === "editSupplement" && (
        <SupplementFormSheet
          supplement={sheet.supplement}
          onClose={() => setSheet(null)}
          onSave={(data) => editSupplement(sheet.supplement.id, data)}
        />
      )}
      {sheet === "reward" && (
        <RewardFormSheet onClose={() => setSheet(null)} onSave={addReward} />
      )}
      {sheet?.type === "editReward" && (
        <RewardFormSheet
          reward={sheet.reward}
          onClose={() => setSheet(null)}
          onSave={(data) => editReward(sheet.reward.id, data)}
        />
      )}
      {sheet === "exercise" && (
        <ExerciseFormSheet
          groups={[...new Set(workout.exercises.map((e) => e.group))]}
          onClose={() => setSheet(null)}
          onSave={addExercise}
        />
      )}
      {sheet?.type === "carga" && (
        <CargaSheet
          exercise={workout.exercises.find((e) => e.id === sheet.exerciseId)}
          onClose={() => setSheet(null)}
          onAdd={(data) => addCargaLog(sheet.exerciseId, data)}
          onDelete={(logId) => deleteCargaLog(sheet.exerciseId, logId)}
        />
      )}
      {sheet === "bodyfat" && (
        <BodyFatFormSheet onClose={() => setSheet(null)} onSave={addBodyFat} />
      )}
      {sheet?.type === "event" && (
        <EventFormSheet
          event={sheet.event}
          dateISO={sheet.dateISO ?? calendar.focusDate}
          startTime={sheet.startTime}
          onClose={() => setSheet(null)}
          onCreate={createCalendarEvent}
          onUpdate={updateCalendarEvent}
          onDelete={calendar.removeEvent}
        />
      )}
      {sheet?.type === "import" && (
        <ImportReviewSheet
          groups={sheet.groups}
          onClose={() => setSheet(null)}
          onConfirm={importParsedWorkout}
        />
      )}
      {sheet?.type === "race" && (
        <RaceFormSheet
          race={sheet.race}
          onClose={() => setSheet(null)}
          onSave={(data) =>
            sheet.race ? running.editRace(sheet.race.id, data) : running.addRace(data)
          }
          onDelete={running.deleteRace}
        />
      )}
      {sheet?.type === "runPlan" && (
        <RunPlanFormSheet
          plan={sheet.plan}
          races={running.races}
          onClose={() => setSheet(null)}
          onSave={(data) =>
            sheet.plan ? running.editPlan(sheet.plan.id, data) : running.addPlan(data)
          }
        />
      )}
      {sheet?.type === "runSession" && (
        <RunSessionFormSheet
          session={sheet.session}
          dateISO={sheet.dateISO}
          plan={running.plan}
          onClose={() => setSheet(null)}
          onSave={(data) =>
            sheet.session
              ? running.editSession(sheet.session.id, data)
              : running.addSession(data)
          }
          onDelete={running.deleteSession}
        />
      )}
      {sheet?.type === "journal" && (
        <JournalEntryFormSheet
          entry={sheet.entry}
          dateISO={sheet.dateISO}
          groups={[...new Set(workout.exercises.map((e) => e.group))]}
          allEntries={journal.entries}
          onClose={() => setSheet(null)}
          onSave={(data) =>
            sheet.entry ? journal.editEntry(sheet.entry.id, data) : journal.addEntry(data)
          }
          onDelete={journal.deleteEntry}
        />
      )}
    </div>
  );
}

export default App;
