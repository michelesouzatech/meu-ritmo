// Conversa com o banco (Supabase). O app continua usando os mesmos formatos de
// dados de sempre — aqui só traduzimos pro formato das tabelas e de volta.
import { supabase } from "./supabase.js";

const PHOTO_BUCKET = "treinos";
const SIGNED_URL_SECONDS = 60 * 60; // 1 hora

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- banco -> app ----------

const toTask = (r) => ({
  id: r.id,
  title: r.title,
  date: r.task_date,
  note: r.note ?? "",
  urgent: r.urgent,
  done: r.done,
});

const toHabit = (r) => ({
  id: r.id,
  name: r.name,
  periodDays: r.period_days,
  startDate: r.start_date,
  completions: [],
});

const toExercise = (r) => ({
  id: r.id,
  group: r.group_name,
  name: r.name,
  setsReps: r.sets_reps ?? "",
  notes: r.notes ?? "",
  cargaLogs: [],
});

const toCargaLog = (r) => ({ id: r.id, date: r.log_date, weight: r.weight });

const toBodyFat = (r) => ({ id: r.id, date: r.measured_on, percent: Number(r.percent) });

// ---------- app -> banco ----------

function taskColumns(data) {
  const out = {};
  if ("title" in data) out.title = data.title;
  if ("date" in data) out.task_date = data.date || null;
  if ("note" in data) out.note = data.note ?? "";
  if ("urgent" in data) out.urgent = !!data.urgent;
  if ("done" in data) out.done = !!data.done;
  return out;
}

function exerciseColumns(data) {
  const out = {};
  if ("group" in data) out.group_name = data.group ?? "";
  if ("name" in data) out.name = data.name;
  if ("setsReps" in data) out.sets_reps = data.setsReps ?? "";
  if ("notes" in data) out.notes = data.notes ?? "";
  return out;
}

// ---------- leitura ----------

async function ensureWorkoutRow(userId) {
  const existing = unwrap(
    await supabase.from("workouts").select("*").eq("user_id", userId).maybeSingle(),
  );
  if (existing) return existing;
  return unwrap(
    await supabase.from("workouts").insert({ user_id: userId }).select().single(),
  );
}

async function signedPhotoUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function loadAll(userId) {
  const workoutRow = await ensureWorkoutRow(userId);

  const [taskRows, habitRows, completionRows, exerciseRows, cargaRows, bodyFatRows, photoUrl] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .then(unwrap),
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .then(unwrap),
      supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", userId)
        .then(unwrap),
      supabase
        .from("exercises")
        .select("*")
        .eq("workout_id", workoutRow.id)
        .order("position")
        .then(unwrap),
      supabase
        .from("carga_logs")
        .select("*")
        .eq("user_id", userId)
        .order("log_date")
        .then(unwrap),
      supabase
        .from("body_fat")
        .select("*")
        .eq("user_id", userId)
        .order("measured_on")
        .then(unwrap),
      signedPhotoUrl(workoutRow.photo_path),
    ]);

  const habits = habitRows.map(toHabit);
  const habitById = new Map(habits.map((h) => [h.id, h]));
  for (const row of completionRows) {
    habitById.get(row.habit_id)?.completions.push(row.completion_date);
  }

  const exercises = exerciseRows.map(toExercise);
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  for (const row of cargaRows) {
    exerciseById.get(row.exercise_id)?.cargaLogs.push(toCargaLog(row));
  }

  return {
    workoutId: workoutRow.id,
    tasks: taskRows.map(toTask),
    habits,
    workout: {
      createdAt: workoutRow.started_on,
      photoName: workoutRow.photo_name,
      photoDataUrl: photoUrl,
      exercises,
    },
    bodyFat: bodyFatRows.map(toBodyFat),
  };
}

// ---------- tarefas ----------

export const insertTask = (userId, task) =>
  supabase
    .from("tasks")
    .insert({ id: task.id, user_id: userId, done: false, ...taskColumns(task) })
    .then(unwrap);

export const updateTask = (id, patch) =>
  supabase.from("tasks").update(taskColumns(patch)).eq("id", id).then(unwrap);

export const removeTask = (id) =>
  supabase.from("tasks").delete().eq("id", id).then(unwrap);

// ---------- hábitos ----------

export const insertHabit = (userId, habit) =>
  supabase
    .from("habits")
    .insert({
      id: habit.id,
      user_id: userId,
      name: habit.name,
      period_days: habit.periodDays ?? null,
      start_date: habit.startDate,
    })
    .then(unwrap);

export const insertCompletion = (userId, habitId, date) =>
  supabase
    .from("habit_completions")
    .insert({ user_id: userId, habit_id: habitId, completion_date: date })
    .then(unwrap);

export const removeCompletion = (habitId, date) =>
  supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("completion_date", date)
    .then(unwrap);

export const removeHabit = (id) =>
  supabase.from("habits").delete().eq("id", id).then(unwrap);

export async function restartHabit(id, startDate) {
  unwrap(await supabase.from("habit_completions").delete().eq("habit_id", id));
  unwrap(await supabase.from("habits").update({ start_date: startDate }).eq("id", id));
}

// ---------- treino ----------

export const setWorkoutStartedOn = (workoutId, date) =>
  supabase.from("workouts").update({ started_on: date }).eq("id", workoutId).then(unwrap);

export const insertExercise = (userId, workoutId, exercise, position) =>
  supabase
    .from("exercises")
    .insert({
      id: exercise.id,
      user_id: userId,
      workout_id: workoutId,
      position,
      ...exerciseColumns(exercise),
    })
    .then(unwrap);

export const updateExercise = (id, patch) =>
  supabase.from("exercises").update(exerciseColumns(patch)).eq("id", id).then(unwrap);

export const removeExercise = (id) =>
  supabase.from("exercises").delete().eq("id", id).then(unwrap);

export async function saveExercisePositions(pairs) {
  for (const { id, position } of pairs) {
    unwrap(await supabase.from("exercises").update({ position }).eq("id", id));
  }
}

export const insertCargaLog = (userId, exerciseId, log) =>
  supabase
    .from("carga_logs")
    .insert({
      id: log.id,
      user_id: userId,
      exercise_id: exerciseId,
      log_date: log.date,
      weight: log.weight ?? "",
    })
    .then(unwrap);

export const removeCargaLog = (id) =>
  supabase.from("carga_logs").delete().eq("id", id).then(unwrap);

// Um treino novo (PDF importado) substitui o treino atual por inteiro.
export async function replaceExercises(userId, workoutId, exercises, startedOn) {
  unwrap(await supabase.from("exercises").delete().eq("workout_id", workoutId));
  await insertExerciseList(userId, workoutId, exercises);
  unwrap(await supabase.from("workouts").update({ started_on: startedOn }).eq("id", workoutId));
}

async function insertExerciseList(userId, workoutId, exercises) {
  if (exercises.length === 0) return;
  unwrap(
    await supabase.from("exercises").insert(
      exercises.map((exercise, position) => ({
        id: exercise.id,
        user_id: userId,
        workout_id: workoutId,
        position,
        ...exerciseColumns(exercise),
      })),
    ),
  );
  const logs = exercises.flatMap((exercise) =>
    (exercise.cargaLogs ?? []).map((log) => ({
      id: log.id,
      user_id: userId,
      exercise_id: exercise.id,
      log_date: log.date,
      weight: log.weight ?? "",
    })),
  );
  if (logs.length > 0) unwrap(await supabase.from("carga_logs").insert(logs));
}

// ---------- foto do treino ----------

export async function uploadWorkoutPhoto(userId, workoutId, photo) {
  const blob = await (await fetch(photo.dataUrl)).blob();
  const extension = photo.name.includes(".") ? photo.name.split(".").pop() : "png";
  const path = `${userId}/treino-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type || undefined, upsert: true });
  if (error) throw error;

  unwrap(
    await supabase
      .from("workouts")
      .update({ photo_name: photo.name, photo_path: path })
      .eq("id", workoutId),
  );
  return await signedPhotoUrl(path);
}

export async function clearWorkoutPhoto(workoutId) {
  const row = unwrap(
    await supabase.from("workouts").select("photo_path").eq("id", workoutId).single(),
  );
  if (row?.photo_path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
  }
  unwrap(
    await supabase
      .from("workouts")
      .update({ photo_name: null, photo_path: null })
      .eq("id", workoutId),
  );
}

// ---------- % de gordura ----------

export const insertBodyFat = (userId, entry) =>
  supabase
    .from("body_fat")
    .insert({
      id: entry.id,
      user_id: userId,
      measured_on: entry.date,
      percent: entry.percent,
    })
    .then(unwrap);

export const removeBodyFat = (id) =>
  supabase.from("body_fat").delete().eq("id", id).then(unwrap);

// ---------- mudança do navegador pro banco ----------

// Sobe de uma vez o que já estava salvo no navegador. Só roda quando a conta
// ainda não tem nada no banco, então não duplica nada.
export async function uploadLocalData(userId, workoutId, local) {
  const { tasks = [], habits = [], workout, bodyFat = [] } = local;

  if (tasks.length > 0) {
    unwrap(
      await supabase.from("tasks").insert(
        tasks.map((task) => ({
          id: task.id,
          user_id: userId,
          done: !!task.done,
          ...taskColumns(task),
        })),
      ),
    );
  }

  if (habits.length > 0) {
    unwrap(
      await supabase.from("habits").insert(
        habits.map((habit) => ({
          id: habit.id,
          user_id: userId,
          name: habit.name,
          period_days: habit.periodDays ?? null,
          start_date: habit.startDate,
        })),
      ),
    );
    const completions = habits.flatMap((habit) =>
      [...new Set(habit.completions ?? [])].map((date) => ({
        user_id: userId,
        habit_id: habit.id,
        completion_date: date,
      })),
    );
    if (completions.length > 0) {
      unwrap(await supabase.from("habit_completions").insert(completions));
    }
  }

  if (workout?.exercises?.length > 0) {
    await insertExerciseList(userId, workoutId, workout.exercises);
  }
  if (workout?.createdAt) {
    unwrap(
      await supabase
        .from("workouts")
        .update({ started_on: workout.createdAt })
        .eq("id", workoutId),
    );
  }

  if (bodyFat.length > 0) {
    unwrap(
      await supabase.from("body_fat").insert(
        bodyFat.map((entry) => ({
          id: entry.id,
          user_id: userId,
          measured_on: entry.date,
          percent: entry.percent,
        })),
      ),
    );
  }
}
