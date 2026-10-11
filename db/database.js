import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'gym_log_book.db';
const SCHEMA_VERSION = 3;

let dbPromise = null;
async function getDb() {
  if (!dbPromise) dbPromise = openDatabaseAsync(DB_NAME);
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDb();

  // Drop old schemas on upgrade — user explicitly opted out of data migration.
  const cur = await db.getFirstAsync('PRAGMA user_version;');
  const version = cur?.user_version ?? 0;
  if (version < SCHEMA_VERSION) {
    await db.execAsync(`
      DROP TABLE IF EXISTS nutrition_logs;
      DROP TABLE IF EXISTS nutrition_quota;
      DROP TABLE IF EXISTS saved_foods;
      DROP TABLE IF EXISTS logs;
      DROP TABLE IF EXISTS workouts;
      DROP TABLE IF EXISTS routine_exercises;
      DROP TABLE IF EXISTS routines;
      DROP TABLE IF EXISTS exercises;
    `);
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      min_val INTEGER NOT NULL DEFAULT 6,
      max_val INTEGER NOT NULL DEFAULT 12,
      num_sets INTEGER NOT NULL DEFAULT 2,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER,
      routine_name TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER,
      exercise_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      set_number INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_exercise_date ON logs(exercise_id, date);
    CREATE INDEX IF NOT EXISTS idx_logs_workout ON logs(workout_id);
    CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id);
  `);
}

/* ── Exercises (the pool) ─────────────────────────────────────────────────── */

export async function getExercises() {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT id, name, min_val, max_val, num_sets, sort_order
     FROM exercises
     ORDER BY sort_order ASC, id ASC;`,
    [],
  );
}

export async function createExercise({ name, min = 6, max = 12, numSets = 2 }) {
  const db = await getDb();
  await db.runAsync(`UPDATE exercises SET sort_order = sort_order + 1;`);
  const res = await db.runAsync(
    `INSERT INTO exercises (name, min_val, max_val, num_sets, sort_order)
     VALUES (?, ?, ?, ?, 0);`,
    [name.trim(), min, max, numSets],
  );
  return res.lastInsertRowId;
}

export async function updateExercise({ id, name, min, max, numSets }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE exercises SET name = ?, min_val = ?, max_val = ?, num_sets = ? WHERE id = ?;`,
    [name.trim(), min, max, numSets, id],
  );
}

export async function deleteExercise(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM exercises WHERE id = ?;`, [id]);
}

export async function reorderExercises(orderedIds) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(`UPDATE exercises SET sort_order = ? WHERE id = ?;`, [i, orderedIds[i]]);
    }
  });
}

/* ── Routines ─────────────────────────────────────────────────────────────── */

export async function getRoutines() {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT r.id, r.name, r.sort_order, COUNT(re.id) AS exercise_count
     FROM routines r
     LEFT JOIN routine_exercises re ON re.routine_id = r.id
     GROUP BY r.id
     ORDER BY r.sort_order ASC, r.id ASC;`,
    [],
  );
}

export async function createRoutine({ name }) {
  const db = await getDb();
  await db.runAsync(`UPDATE routines SET sort_order = sort_order + 1;`);
  const res = await db.runAsync(
    `INSERT INTO routines (name, sort_order) VALUES (?, 0);`,
    [name.trim()],
  );
  return res.lastInsertRowId;
}

export async function updateRoutine({ id, name }) {
  const db = await getDb();
  await db.runAsync(`UPDATE routines SET name = ? WHERE id = ?;`, [name.trim(), id]);
}

export async function deleteRoutine(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM routines WHERE id = ?;`, [id]);
}

export async function reorderRoutines(orderedIds) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(`UPDATE routines SET sort_order = ? WHERE id = ?;`, [i, orderedIds[i]]);
    }
  });
}

/* ── Routine ↔ Exercise junction ──────────────────────────────────────────── */

export async function getRoutineExercises(routineId) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT re.id, re.routine_id, re.exercise_id, re.sort_order,
            e.name, e.min_val, e.max_val, e.num_sets
     FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ?
     ORDER BY re.sort_order ASC, re.id ASC;`,
    [routineId],
  );
}

export async function addExerciseToRoutine({ routineId, exerciseId }) {
  const db = await getDb();
  const maxRow = await db.getFirstAsync(
    `SELECT COALESCE(MAX(sort_order), -1) AS m FROM routine_exercises WHERE routine_id = ?;`,
    [routineId],
  );
  const order = (maxRow?.m ?? -1) + 1;
  const res = await db.runAsync(
    `INSERT INTO routine_exercises (routine_id, exercise_id, sort_order) VALUES (?, ?, ?);`,
    [routineId, exerciseId, order],
  );
  return res.lastInsertRowId;
}

export async function removeExerciseFromRoutine(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM routine_exercises WHERE id = ?;`, [id]);
}

export async function reorderRoutineExercises(orderedIds) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(`UPDATE routine_exercises SET sort_order = ? WHERE id = ?;`, [i, orderedIds[i]]);
    }
  });
}

/* ── Workouts + Logs ──────────────────────────────────────────────────────── */

export async function startWorkout({ routineId, routineName, startedAtISO }) {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO workouts (routine_id, routine_name, started_at) VALUES (?, ?, ?);`,
    [routineId ?? null, routineName ?? null, startedAtISO],
  );
  return res.lastInsertRowId;
}

export async function addLog({ workoutId, exerciseId, dateISO, weight, reps, setNumber = 1 }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO logs (workout_id, exercise_id, date, weight, reps, set_number)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [workoutId ?? null, exerciseId, dateISO, weight, reps, setNumber],
  );
}

export async function getLastSetsForExerciseIds(exerciseIds) {
  if (!exerciseIds?.length) return {};
  const db = await getDb();
  const placeholders = exerciseIds.map(() => '?').join(',');
  const latest = await db.getAllAsync(
    `SELECT exercise_id, MAX(date) AS d
     FROM logs
     WHERE exercise_id IN (${placeholders})
     GROUP BY exercise_id;`,
    exerciseIds,
  );
  const out = {};
  for (const row of latest) {
    const sets = await db.getAllAsync(
      `SELECT weight, reps, set_number
       FROM logs
       WHERE exercise_id = ? AND date = ?
       ORDER BY set_number ASC;`,
      [row.exercise_id, row.d],
    );
    out[row.exercise_id] = {
      date: row.d,
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, setNumber: s.set_number })),
    };
  }
  return out;
}
