import { useCallback, useEffect, useRef, useState } from "react";
import BottomNav from "./components/BottomNav.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import TasksScreen, { TaskFormSheet } from "./screens/TasksScreen.jsx";
import HabitsScreen, { HabitFormSheet } from "./screens/HabitsScreen.jsx";
import WorkoutScreen, {
  ExerciseFormSheet,
  CargaSheet,
  BodyFatFormSheet,
  ImportReviewSheet,
} from "./screens/WorkoutScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import CatMascot from "./components/CatMascot.jsx";
import EventFormSheet from "./components/EventFormSheet.jsx";
import { todayISO } from "./lib/date.js";
import { buildInitialWorkoutSeed } from "./lib/seedWorkout.js";
import { supabase } from "./lib/supabase.js";
import { clearGoogleToken, connectGoogleCalendar } from "./lib/googleCalendar.js";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar.js";
import * as db from "./lib/db.js";

const emptyWorkout = { createdAt: null, photoName: null, photoDataUrl: null, exercises: [] };
const LOCAL_PREFIX = "meuritmo:";
const SEED_FLAG_KEY = "meuritmo:seeded-workout-v1";

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
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [workoutId, setWorkoutId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [workout, setWorkout] = useState(emptyWorkout);
  const [bodyFat, setBodyFat] = useState([]);

  // Guarda a lista atual pra calcular posições sem depender do render.
  const exercisesRef = useRef([]);
  exercisesRef.current = workout.exercises;
  const habitsRef = useRef([]);
  habitsRef.current = habits;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
        setWorkout(data.workout);
        setBodyFat(data.bodyFat);
      } catch {
        if (!cancelled) setSaveError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Salva no banco em segundo plano; se falhar, avisa em vez de sumir calado.
  const save = useCallback((run) => {
    Promise.resolve()
      .then(run)
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
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
    save(() => db.updateTask(id, { done }));
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

  function reorderHabits(orderedIds) {
    const byId = new Map(habitsRef.current.map((h) => [h.id, h]));
    const reordered = orderedIds.map((id) => byId.get(id));
    setHabits(reordered);
    const pairs = reordered.map((h, position) => ({ id: h.id, position }));
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
    save(() =>
      wasDone ? db.removeCompletion(id, date) : db.insertCompletion(userId, id, date),
    );
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    save(() => db.removeHabit(id));
  }

  function restartHabit(id) {
    const startDate = todayISO();
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, startDate, completions: [] } : h)),
    );
    save(() => db.restartHabit(id, startDate));
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

  function handleLogout() {
    clearGoogleToken();
    supabase.auth.signOut();
  }

  if (session === undefined) {
    return <div className="min-h-dvh bg-ritmo-bg" />;
  }

  if (session === null) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ritmo-bg">
        <CatMascot size={120} className="animate-pulse" />
        <p className="text-sm text-ritmo-text/50">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex justify-center bg-ritmo-bg">
      <div className="w-full max-w-md px-5 pt-8 pb-28">
        {saveError && (
          <div className="mb-4 rounded-xl bg-ritmo-pink-light px-3 py-2 text-xs text-ritmo-pink-deep">
            Não deu pra salvar na nuvem agora. Confira sua internet — o que você
            fez continua na tela, mas pode não estar salvo.
          </div>
        )}

        {tab === "home" && (
          <HomeScreen
            tasks={tasks}
            habits={habits}
            user={session.user}
            calendar={calendar}
            onToggleTask={toggleTask}
            onToggleHabitToday={(id) => toggleHabitDate(id, todayISO())}
            onConnectCalendar={connectGoogleCalendar}
            onRefreshCalendar={calendar.refresh}
            onOpenEvent={(event) => setSheet({ type: "event", event })}
            onNewEvent={(dateISO, startTime) =>
              setSheet({ type: "event", event: null, dateISO, startTime })
            }
            onNavigate={setTab}
          />
        )}
        {tab === "tasks" && (
          <TasksScreen
            tasks={tasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onAdd={() => setSheet("task")}
          />
        )}
        {tab === "habits" && (
          <HabitsScreen
            habits={habits}
            onToggleDate={toggleHabitDate}
            onDelete={deleteHabit}
            onRestart={restartHabit}
            onEdit={(habit) => setSheet({ type: "editHabit", habit })}
            onReorder={reorderHabits}
            onAdd={() => setSheet("habit")}
          />
        )}
        {tab === "workout" && (
          <WorkoutScreen
            workout={workout}
            bodyFat={bodyFat}
            onAddExercise={() => setSheet("exercise")}
            onUpdateExercise={updateExercise}
            onDeleteExercise={deleteExercise}
            onOpenCarga={(exerciseId) => setSheet({ type: "carga", exerciseId })}
            onSetPhoto={setWorkoutPhoto}
            onNewCycle={startNewWorkoutCycle}
            onAddBodyFat={() => setSheet("bodyfat")}
            onDeleteBodyFat={deleteBodyFat}
            onImportParsed={(groups) => setSheet({ type: "import", groups })}
            onReorderExercises={reorderExercises}
          />
        )}
        {tab === "profile" && (
          <ProfileScreen
            user={session.user}
            tasks={tasks}
            habits={habits}
            workout={workout}
            bodyFat={bodyFat}
            calendar={calendar}
            onLogout={handleLogout}
            onNavigate={setTab}
          />
        )}
      </div>

      <BottomNav active={tab} onNavigate={setTab} />

      {sheet === "task" && (
        <TaskFormSheet onClose={() => setSheet(null)} onSave={addTask} />
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
    </div>
  );
}

export default App;
