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

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON nutrition_logs(date);

    CREATE TABLE IF NOT EXISTS nutrition_quota (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      calories REAL NOT NULL DEFAULT 2500,
      protein REAL NOT NULL DEFAULT 150,
      carbs REAL NOT NULL DEFAULT 300,
      fat REAL NOT NULL DEFAULT 80
    );
    INSERT OR IGNORE INTO nutrition_quota (id, calories, protein, carbs, fat) VALUES (1, 2500, 150, 300, 80);

    CREATE TABLE IF NOT EXISTS saved_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0
    );
  `);

  // Migration for older installs (before `unit` existed).
  await ensureColumnExists({ tableName: 'logs', columnName: 'unit', columnDDL: "unit TEXT NOT NULL DEFAULT 'kg'" });
  await ensureColumnExists({ tableName: 'nutrition_logs', columnName: 'food_name', columnDDL: "food_name TEXT DEFAULT ''" });
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

// --- Nutrition (standalone calorie/macros log) ---
export async function addNutritionLog({ date, calories = 0, protein = 0, carbs = 0, fat = 0 }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nutrition_logs (date, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?);`,
    [date, Number(calories) || 0, Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0],
  );
}

export async function getNutritionLogsForDate(date) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT id, date, calories, protein, carbs, fat, food_name FROM nutrition_logs WHERE date = ? ORDER BY id DESC;`,
    [date],
  );
  return (rows || []).map((r) => ({
    id: r.id,
    date: r.date,
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    foodName: r.food_name ?? "",
  }));
}

export async function deleteNutritionLog(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM nutrition_logs WHERE id = ?;`, [id]);
}

export async function updateNutritionLogFoodName(id, foodName) {
  const db = await getDb();
  await db.runAsync(`UPDATE nutrition_logs SET food_name = ? WHERE id = ?;`, [String(foodName ?? "").trim(), id]);
}

export async function getNutritionTotalsForDate(date) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT
       COALESCE(SUM(calories), 0) as calories,
       COALESCE(SUM(protein), 0) as protein,
       COALESCE(SUM(carbs), 0) as carbs,
       COALESCE(SUM(fat), 0) as fat
     FROM nutrition_logs WHERE date = ?;`,
    [date],
  );
  return row
    ? {
        calories: row.calories ?? 0,
        protein: row.protein ?? 0,
        carbs: row.carbs ?? 0,
        fat: row.fat ?? 0,
      }
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export async function getNutritionQuota() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT calories, protein, carbs, fat FROM nutrition_quota WHERE id = 1;`, []);
  return row
    ? {
        calories: row.calories ?? 2500,
        protein: row.protein ?? 150,
        carbs: row.carbs ?? 300,
        fat: row.fat ?? 80,
      }
    : { calories: 2500, protein: 150, carbs: 300, fat: 80 };
}

export async function setNutritionQuota({ calories, protein, carbs, fat }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nutrition_quota (id, calories, protein, carbs, fat) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET calories = ?, protein = ?, carbs = ?, fat = ?;`,
    [
      Number(calories) ?? 2500,
      Number(protein) ?? 150,
      Number(carbs) ?? 300,
      Number(fat) ?? 80,
      Number(calories) ?? 2500,
      Number(protein) ?? 150,
      Number(carbs) ?? 300,
      Number(fat) ?? 80,
    ],
  );
}

// --- Saved Foods ---
export async function addSavedFood({ name, calories = 0, protein = 0, carbs = 0, fat = 0 }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO saved_foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?);`,
    [String(name).trim(), Number(calories) || 0, Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0],
  );
}

export async function getSavedFoods() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT id, name, calories, protein, carbs, fat FROM saved_foods ORDER BY id DESC;`,
    [],
  );
  return (rows || []).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
  }));
}

export async function deleteSavedFood(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM saved_foods WHERE id = ?;`, [id]);
}

