import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'gym_log_book.db';

let dbPromise = null;
async function getDb() {
  if (!dbPromise) dbPromise = openDatabaseAsync(DB_NAME);
  return dbPromise;
}

async function ensureColumnExists({ tableName, columnName, columnDDL }) {
  const db = await getDb();
  const cols = await db.getAllAsync(`PRAGMA table_info(${tableName});`, []);
  const has = cols.some((c) => String(c.name).toLowerCase() === String(columnName).toLowerCase());
  if (!has) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnDDL};`);
  }
}

export async function initDatabase() {
  const db = await getDb();

  // Multi-statement init. (Foreign keys are disabled by default in SQLite.)
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      split_index INTEGER NOT NULL,
      planned_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      reps INTEGER NOT NULL,
      set_type TEXT NOT NULL CHECK (set_type IN ('TOP_SET','BACK_OFF')),
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_exercise_date ON logs(exercise_name, date);
    CREATE INDEX IF NOT EXISTS idx_logs_workout ON logs(workout_id);
  `);

  // Migration for older installs (before `unit` existed).
  await ensureColumnExists({ tableName: 'logs', columnName: 'unit', columnDDL: "unit TEXT NOT NULL DEFAULT 'kg'" });
}

export async function getActiveWorkout() {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM workouts WHERE completed_at IS NULL ORDER BY started_at DESC LIMIT 1;`,
    [],
  );
}

export async function getLastCompletedWorkout() {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM workouts WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1;`,
    [],
  );
}

export async function startWorkout({ splitIndex, plannedName, startedAtISO }) {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO workouts (split_index, planned_name, started_at) VALUES (?, ?, ?);`,
    [splitIndex, plannedName, startedAtISO],
  );
  return res.lastInsertRowId;
}

export async function finishWorkout({ workoutId, completedAtISO }) {
  const db = await getDb();
  await db.runAsync(`UPDATE workouts SET completed_at = ? WHERE id = ?;`, [completedAtISO, workoutId]);
}

export async function addLog({
  workoutId,
  exerciseName,
  dateISO,
  weight,
  unit, // 'kg' | 'lbs'
  reps,
  setType, // 'TOP_SET' | 'BACK_OFF'
}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO logs (workout_id, exercise_name, date, weight, unit, reps, set_type)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [workoutId, exerciseName, dateISO, weight, unit || 'kg', reps, setType],
  );
}

export async function getWorkoutLogs(workoutId) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM logs WHERE workout_id = ? ORDER BY date DESC, id DESC;`,
    [workoutId],
  );
}

export async function getDistinctExercises() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT exercise_name as name FROM logs GROUP BY exercise_name ORDER BY exercise_name ASC;`,
    [],
  );
  return rows.map((r) => r.name);
}

// Groups TOP_SET + BACK_OFF into a single "entry" (like your web app).
export async function getExerciseEntries({ exerciseName, limit = 50 }) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT
        date,
        weight,
        unit,
        MAX(CASE WHEN set_type = 'TOP_SET' THEN reps END) as top_reps,
        MAX(CASE WHEN set_type = 'BACK_OFF' THEN reps END) as back_reps
      FROM logs
      WHERE exercise_name = ?
      GROUP BY date, weight, unit
      ORDER BY date DESC
      LIMIT ?;`,
    [exerciseName, limit],
  );
}

export async function getLastExerciseEntry({ exerciseName }) {
  const rows = await getExerciseEntries({ exerciseName, limit: 1 });
  return rows.length ? rows[0] : null;
}

export async function deleteExerciseEntry({ exerciseName, dateISO }) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM logs WHERE exercise_name = ? AND date = ?;`, [exerciseName, dateISO]);
}

export async function getExerciseHistory({ exerciseName, limit = 100 }) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT l.*, w.split_index, w.planned_name, w.completed_at
     FROM logs l
     JOIN workouts w ON w.id = l.workout_id
     WHERE l.exercise_name = ?
     ORDER BY l.date DESC, l.id DESC
     LIMIT ?;`,
    [exerciseName, limit],
  );
}

