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
  status: r.status ?? "active",
  endedAt: r.ended_at ?? null,
  completions: [],
});

const toSupplement = (r) => ({
  id: r.id,
  name: r.name,
  scheduleLabel: r.schedule_label ?? "",
  dose: r.dose ?? "",
  active: r.active,
  endedAt: r.ended_at ?? null,
  createdAt: r.created_at,
  takenDates: [],
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

const numberOrNull = (v) => (v == null ? null : Number(v));

const toRace = (r) => ({
  id: r.id,
  name: r.name,
  date: r.race_date,
  time: r.start_time ? r.start_time.slice(0, 5) : "",
  location: r.location ?? "",
  distanceKm: Number(r.distance_km),
  category: r.category ?? "",
  goalPace: numberOrNull(r.goal_pace_seconds),
  resultTime: numberOrNull(r.result_time_seconds),
  rankOverall: numberOrNull(r.rank_overall),
  rankCategory: numberOrNull(r.rank_category),
  notes: r.notes ?? "",
  calendarEventId: r.calendar_event_id ?? null,
});

const toRunPlan = (r) => ({
  id: r.id,
  raceId: r.race_id,
  name: r.name,
  weeklyTarget: r.weekly_target,
  goalPace: numberOrNull(r.goal_pace_seconds),
  startDate: r.start_date,
  endDate: r.end_date,
  archived: r.archived,
});

const toJournalEntry = (r) => ({
  id: r.id,
  date: r.entry_date,
  activityType: r.activity_type,
  activityLabel: r.activity_label ?? "",
  feeling: r.feeling,
  notes: r.notes ?? "",
});

const toReward = (r) => ({ id: r.id, name: r.name, cost: r.cost });

const toRedemption = (r) => ({
  id: r.id,
  rewardId: r.reward_id,
  rewardName: r.reward_name,
  cost: r.cost,
  redeemedAt: r.redeemed_at,
});

const toRunSession = (r) => ({
  id: r.id,
  planId: r.plan_id,
  date: r.session_date,
  distanceKm: numberOrNull(r.distance_km),
  duration: numberOrNull(r.duration_seconds),
  kind: r.kind ?? "",
  notes: r.notes ?? "",
});

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

function habitColumns(data) {
  const out = {};
  if ("name" in data) out.name = data.name;
  if ("periodDays" in data) out.period_days = data.periodDays ?? null;
  if ("startDate" in data) out.start_date = data.startDate;
  if ("status" in data) out.status = data.status;
  if ("endedAt" in data) out.ended_at = data.endedAt ?? null;
  return out;
}

function supplementColumns(data) {
  const out = {};
  if ("name" in data) out.name = data.name;
  if ("scheduleLabel" in data) out.schedule_label = data.scheduleLabel ?? "";
  if ("dose" in data) out.dose = data.dose ?? "";
  if ("active" in data) out.active = !!data.active;
  if ("endedAt" in data) out.ended_at = data.endedAt ?? null;
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

function raceColumns(data) {
  const out = {};
  if ("name" in data) out.name = data.name;
  if ("date" in data) out.race_date = data.date;
  if ("time" in data) out.start_time = data.time || null;
  if ("location" in data) out.location = data.location ?? "";
  if ("distanceKm" in data) out.distance_km = data.distanceKm;
  if ("category" in data) out.category = data.category ?? "";
  if ("goalPace" in data) out.goal_pace_seconds = data.goalPace ?? null;
  if ("resultTime" in data) out.result_time_seconds = data.resultTime ?? null;
  if ("rankOverall" in data) out.rank_overall = data.rankOverall ?? null;
  if ("rankCategory" in data) out.rank_category = data.rankCategory ?? null;
  if ("notes" in data) out.notes = data.notes ?? "";
  if ("calendarEventId" in data) out.calendar_event_id = data.calendarEventId ?? null;
  return out;
}

function runPlanColumns(data) {
  const out = {};
  if ("raceId" in data) out.race_id = data.raceId ?? null;
  if ("name" in data) out.name = data.name;
  if ("weeklyTarget" in data) out.weekly_target = data.weeklyTarget;
  if ("goalPace" in data) out.goal_pace_seconds = data.goalPace ?? null;
  if ("startDate" in data) out.start_date = data.startDate;
  if ("endDate" in data) out.end_date = data.endDate ?? null;
  if ("archived" in data) out.archived = !!data.archived;
  return out;
}

function journalColumns(data) {
  const out = {};
  if ("date" in data) out.entry_date = data.date;
  if ("activityType" in data) out.activity_type = data.activityType;
  if ("activityLabel" in data) out.activity_label = data.activityLabel ?? "";
  if ("feeling" in data) out.feeling = data.feeling;
  if ("notes" in data) out.notes = data.notes ?? "";
  return out;
}

function rewardColumns(data) {
  const out = {};
  if ("name" in data) out.name = data.name;
  if ("cost" in data) out.cost = data.cost;
  return out;
}

function runSessionColumns(data) {
  const out = {};
  if ("planId" in data) out.plan_id = data.planId ?? null;
  if ("date" in data) out.session_date = data.date;
  if ("distanceKm" in data) out.distance_km = data.distanceKm ?? null;
  if ("duration" in data) out.duration_seconds = data.duration ?? null;
  if ("kind" in data) out.kind = data.kind ?? "";
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

  const [
    taskRows,
    habitRows,
    completionRows,
    supplementRows,
    supplementLogRows,
    exerciseRows,
    cargaRows,
    bodyFatRows,
    photoUrl,
    raceRows,
    runPlanRows,
    runSessionRows,
    journalRows,
    pointRuleRows,
    pointsRows,
    rewardRows,
    redemptionRows,
  ] = await Promise.all([
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
        .order("position")
        .then(unwrap),
      supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", userId)
        .then(unwrap),
      supabase
        .from("supplements")
        .select("*")
        .eq("user_id", userId)
        .order("position")
        .then(unwrap),
      supabase
        .from("supplement_logs")
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
      supabase
        .from("races")
        .select("*")
        .eq("user_id", userId)
        .order("race_date")
        .then(unwrap),
      supabase
        .from("run_plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .then(unwrap),
      supabase
        .from("run_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("session_date")
        .then(unwrap),
      supabase
        .from("workout_journal")
        .select("*")
        .eq("user_id", userId)
        .order("entry_date")
        .then(unwrap),
      supabase.from("point_rules").select("*").then(unwrap),
      supabase.from("points_ledger").select("points").eq("user_id", userId).then(unwrap),
      supabase
        .from("rewards")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .then(unwrap),
      supabase
        .from("reward_redemptions")
        .select("*")
        .eq("user_id", userId)
        .order("redeemed_at", { ascending: false })
        .then(unwrap),
    ]);

  const habits = habitRows.map(toHabit);
  const habitById = new Map(habits.map((h) => [h.id, h]));
  for (const row of completionRows) {
    habitById.get(row.habit_id)?.completions.push(row.completion_date);
  }

  const supplements = supplementRows.map(toSupplement);
  const supplementById = new Map(supplements.map((s) => [s.id, s]));
  for (const row of supplementLogRows) {
    supplementById.get(row.supplement_id)?.takenDates.push(row.log_date);
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
    supplements,
    workout: {
      createdAt: workoutRow.started_on,
      photoName: workoutRow.photo_name,
      photoDataUrl: photoUrl,
      exercises,
    },
    bodyFat: bodyFatRows.map(toBodyFat),
    running: {
      races: raceRows.map(toRace),
      plans: runPlanRows.map(toRunPlan),
      sessions: runSessionRows.map(toRunSession),
    },
    journal: journalRows.map(toJournalEntry),
    pointRules: Object.fromEntries(pointRuleRows.map((r) => [r.event_type, r.points])),
    pointsEarned: pointsRows.reduce((sum, r) => sum + r.points, 0),
    pointsSpent: redemptionRows.reduce((sum, r) => sum + r.cost, 0),
    rewards: rewardRows.map(toReward),
    redemptions: redemptionRows.map(toRedemption),
  };
}

// ---------- pontos ----------

// source_id é uma chave natural (não o id da linha) — evita ida extra ao
// banco só pra descobrir o id de algo que a tela já sabe identificar sozinha
// (ex: habitId+data). O índice único em (event_type, source_id) garante que
// marcar/desmarcar não duplica nem perde pontos.
export async function awardPoints(userId, eventType, sourceId, points, eventDate) {
  if (!points) return;
  const { error } = await supabase.from("points_ledger").insert({
    user_id: userId,
    event_type: eventType,
    source_id: sourceId,
    points,
    event_date: eventDate,
  });
  if (error && error.code !== "23505") throw error;
}

export const revokePoints = (eventType, sourceId) =>
  supabase
    .from("points_ledger")
    .delete()
    .eq("event_type", eventType)
    .eq("source_id", sourceId)
    .then(unwrap);

// ---------- recompensas ----------

export const insertReward = (userId, reward) =>
  supabase
    .from("rewards")
    .insert({ id: reward.id, user_id: userId, ...rewardColumns(reward) })
    .then(unwrap);

export const updateReward = (id, patch) =>
  supabase.from("rewards").update(rewardColumns(patch)).eq("id", id).then(unwrap);

export const removeReward = (id) =>
  supabase.from("rewards").delete().eq("id", id).then(unwrap);

// A recompensa fica com nome e custo gravados na hora do resgate — se você
// editar ou excluir a recompensa depois, o histórico continua contando a
// mesma história de quando ela foi trocada por pontos.
export const redeemReward = (userId, redemption) =>
  supabase
    .from("reward_redemptions")
    .insert({
      id: redemption.id,
      user_id: userId,
      reward_id: redemption.rewardId,
      reward_name: redemption.rewardName,
      cost: redemption.cost,
    })
    .then(unwrap);

export const removeRedemption = (id) =>
  supabase.from("reward_redemptions").delete().eq("id", id).then(unwrap);

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

export const insertHabit = (userId, habit, position) =>
  supabase
    .from("habits")
    .insert({
      id: habit.id,
      user_id: userId,
      name: habit.name,
      period_days: habit.periodDays ?? null,
      start_date: habit.startDate,
      position,
    })
    .then(unwrap);

export const updateHabit = (id, patch) =>
  supabase.from("habits").update(habitColumns(patch)).eq("id", id).then(unwrap);

export async function saveHabitPositions(pairs) {
  for (const { id, position } of pairs) {
    unwrap(await supabase.from("habits").update({ position }).eq("id", id));
  }
}

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

export const finishHabit = (id) =>
  supabase
    .from("habits")
    .update({ status: "finished", ended_at: new Date().toISOString() })
    .eq("id", id)
    .then(unwrap);

export const reactivateHabit = (id) =>
  supabase
    .from("habits")
    .update({ status: "active", ended_at: null })
    .eq("id", id)
    .then(unwrap);

// ---------- suplementos ----------

export const insertSupplement = (userId, supplement, position) =>
  supabase
    .from("supplements")
    .insert({
      id: supplement.id,
      user_id: userId,
      position,
      ...supplementColumns({ active: true, ...supplement }),
    })
    .then(unwrap);

export const updateSupplement = (id, patch) =>
  supabase.from("supplements").update(supplementColumns(patch)).eq("id", id).then(unwrap);

export const removeSupplement = (id) =>
  supabase.from("supplements").delete().eq("id", id).then(unwrap);

export const finishSupplement = (id) =>
  supabase
    .from("supplements")
    .update({ active: false, ended_at: new Date().toISOString() })
    .eq("id", id)
    .then(unwrap);

export const reactivateSupplement = (id) =>
  supabase
    .from("supplements")
    .update({ active: true, ended_at: null })
    .eq("id", id)
    .then(unwrap);

export const insertSupplementLog = (userId, supplementId, date) =>
  supabase
    .from("supplement_logs")
    .insert({ user_id: userId, supplement_id: supplementId, log_date: date })
    .then(unwrap);

export const removeSupplementLog = (supplementId, date) =>
  supabase
    .from("supplement_logs")
    .delete()
    .eq("supplement_id", supplementId)
    .eq("log_date", date)
    .then(unwrap);

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

// ---------- corrida: provas ----------

export const insertRace = (userId, race) =>
  supabase
    .from("races")
    .insert({ id: race.id, user_id: userId, ...raceColumns(race) })
    .then(unwrap);

export const updateRace = (id, patch) =>
  supabase.from("races").update(raceColumns(patch)).eq("id", id).then(unwrap);

export const removeRace = (id) =>
  supabase.from("races").delete().eq("id", id).then(unwrap);

// ---------- corrida: plano de treino ----------

export const insertRunPlan = (userId, plan) =>
  supabase
    .from("run_plans")
    .insert({ id: plan.id, user_id: userId, ...runPlanColumns(plan) })
    .then(unwrap);

export const updateRunPlan = (id, patch) =>
  supabase.from("run_plans").update(runPlanColumns(patch)).eq("id", id).then(unwrap);

export const removeRunPlan = (id) =>
  supabase.from("run_plans").delete().eq("id", id).then(unwrap);

// Só um plano ativo por vez: ao criar o novo, os outros viram histórico.
export async function archiveOtherPlans(userId, keepId) {
  const query = supabase.from("run_plans").update({ archived: true }).eq("user_id", userId);
  unwrap(await (keepId ? query.neq("id", keepId) : query));
}

// ---------- corrida: cada corrida feita ----------

export const insertRunSession = (userId, session) =>
  supabase
    .from("run_sessions")
    .insert({ id: session.id, user_id: userId, ...runSessionColumns(session) })
    .then(unwrap);

export const updateRunSession = (id, patch) =>
  supabase.from("run_sessions").update(runSessionColumns(patch)).eq("id", id).then(unwrap);

export const removeRunSession = (id) =>
  supabase.from("run_sessions").delete().eq("id", id).then(unwrap);

// ---------- diário de treino ----------

export const insertJournalEntry = (userId, entry) =>
  supabase
    .from("workout_journal")
    .insert({ id: entry.id, user_id: userId, ...journalColumns(entry) })
    .then(unwrap);

export const updateJournalEntry = (id, patch) =>
  supabase.from("workout_journal").update(journalColumns(patch)).eq("id", id).then(unwrap);

export const removeJournalEntry = (id) =>
  supabase.from("workout_journal").delete().eq("id", id).then(unwrap);

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
        habits.map((habit, position) => ({
          id: habit.id,
          user_id: userId,
          name: habit.name,
          period_days: habit.periodDays ?? null,
          start_date: habit.startDate,
          position,
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
