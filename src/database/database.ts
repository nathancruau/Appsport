import * as SQLite from 'expo-sqlite/legacy';
import { Exercise, Workout, WorkoutSet, PersonalRecord } from '../types';
import { estimateOneRM } from '../utils/calculations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (SQLite as any).openDatabase('appsport.db');

// ─── Promise helpers ──────────────────────────────────────────────────────────

function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, { rows }: any) => resolve(rows._array as T[]),
          (_: any, error: any) => { reject(error); return false; }
        );
      },
      (error: any) => reject(error)
    );
  });
}

function run(sql: string, params: any[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, result: any) => resolve(result.insertId ?? 0),
          (_: any, error: any) => { reject(error); return false; }
        );
      },
      (error: any) => reject(error)
    );
  });
}

function batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        for (const { sql, params = [] } of statements) {
          tx.executeSql(sql, params, undefined, (_: any, error: any) => { reject(error); return false; });
        }
      },
      (error: any) => reject(error),
      () => resolve()
    );
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  await batch([
    { sql: `CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, muscle_group TEXT NOT NULL DEFAULT 'other', exercise_type TEXT NOT NULL DEFAULT 'strength', created_at TEXT NOT NULL DEFAULT (datetime('now')))` },
    { sql: `CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT NOT NULL, duration INTEGER, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))` },
    { sql: `CREATE TABLE IF NOT EXISTS workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, order_index INTEGER NOT NULL DEFAULT 0)` },
    { sql: `CREATE TABLE IF NOT EXISTS sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_exercise_id INTEGER NOT NULL, set_number INTEGER NOT NULL, reps INTEGER, weight REAL, duration INTEGER, is_warmup INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 1)` },
    { sql: `CREATE TABLE IF NOT EXISTS personal_records (id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, weight REAL, reps INTEGER, one_rm REAL, workout_id INTEGER, date TEXT NOT NULL)` },
  ]);

  const rows = await query<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
  if ((rows[0]?.count ?? 0) === 0) await seedDefaultExercises();
}

async function seedDefaultExercises(): Promise<void> {
  const data: [string, string, string][] = [
    ['Développé couché barre', 'chest', 'strength'],
    ['Développé couché haltères', 'chest', 'strength'],
    ['Développé incliné', 'chest', 'strength'],
    ['Développé décliné', 'chest', 'strength'],
    ['Écarté poulie', 'chest', 'strength'],
    ['Pompes', 'chest', 'bodyweight'],
    ['Tractions', 'back', 'bodyweight'],
    ['Rowing barre', 'back', 'strength'],
    ['Tirage poulie haute', 'back', 'strength'],
    ['Rowing haltère', 'back', 'strength'],
    ['Soulevé de terre', 'back', 'strength'],
    ['Pull-over', 'back', 'strength'],
    ['Squat barre', 'legs', 'strength'],
    ['Leg press', 'legs', 'strength'],
    ['Fentes', 'legs', 'strength'],
    ['Leg curl', 'legs', 'strength'],
    ['Leg extension', 'legs', 'strength'],
    ['Mollets machine', 'legs', 'strength'],
    ['Soulevé de terre roumain', 'legs', 'strength'],
    ['Développé militaire', 'shoulders', 'strength'],
    ['Élévations latérales', 'shoulders', 'strength'],
    ['Élévations frontales', 'shoulders', 'strength'],
    ['Oiseau haltères', 'shoulders', 'strength'],
    ['Curl barre', 'arms', 'strength'],
    ['Curl haltères', 'arms', 'strength'],
    ['Curl marteau', 'arms', 'strength'],
    ['Triceps poulie', 'arms', 'strength'],
    ['Dips', 'arms', 'bodyweight'],
    ['Extension triceps', 'arms', 'strength'],
    ['Crunch', 'core', 'bodyweight'],
    ['Planche', 'core', 'bodyweight'],
    ['Ab wheel', 'core', 'bodyweight'],
    ['Relevé de jambes', 'core', 'bodyweight'],
  ];
  for (const [name, muscle, type] of data) {
    await run('INSERT OR IGNORE INTO exercises (name, muscle_group, exercise_type) VALUES (?, ?, ?)', [name, muscle, type]);
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapExercise(row: any): Exercise {
  return { id: row.id, name: row.name, muscleGroup: row.muscle_group, exerciseType: row.exercise_type, createdAt: row.created_at };
}

function mapSet(row: any): WorkoutSet {
  return { id: row.id, workoutExerciseId: row.workout_exercise_id, setNumber: row.set_number, reps: row.reps, weight: row.weight, duration: row.duration, isWarmup: row.is_warmup === 1, completed: row.completed === 1 };
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function getAllExercises(): Promise<Exercise[]> {
  return (await query<any>('SELECT * FROM exercises ORDER BY muscle_group, name')).map(mapExercise);
}

export async function createExercise(name: string, muscleGroup: string, exerciseType: string): Promise<Exercise> {
  const id = await run('INSERT INTO exercises (name, muscle_group, exercise_type) VALUES (?, ?, ?)', [name, muscleGroup, exerciseType]);
  return { id, name, muscleGroup, exerciseType: exerciseType as Exercise['exerciseType'], createdAt: new Date().toISOString() };
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export async function saveWorkout(params: {
  name: string | null;
  date: string;
  duration: number;
  exercises: { exerciseId: number; sets: { reps: number | null; weight: number | null; isWarmup: boolean; completed: boolean }[] }[];
}): Promise<number> {
  const workoutId = await run('INSERT INTO workouts (name, date, duration) VALUES (?, ?, ?)', [params.name, params.date, params.duration]);

  for (let i = 0; i < params.exercises.length; i++) {
    const ex = params.exercises[i];
    const weId = await run('INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)', [workoutId, ex.exerciseId, i]);

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      await run('INSERT INTO sets (workout_exercise_id, set_number, reps, weight, is_warmup, completed) VALUES (?, ?, ?, ?, ?, ?)',
        [weId, j + 1, s.reps, s.weight, s.isWarmup ? 1 : 0, s.completed ? 1 : 0]);
    }

    const completedSets = ex.sets.filter((s) => s.completed && !s.isWarmup && s.reps && s.weight);
    if (completedSets.length > 0) {
      const best = completedSets.reduce((a, b) =>
        estimateOneRM(a.weight!, a.reps!) >= estimateOneRM(b.weight!, b.reps!) ? a : b
      );
      const new1RM = estimateOneRM(best.weight!, best.reps!);
      const existing = await query<{ one_rm: number }>('SELECT one_rm FROM personal_records WHERE exercise_id = ? ORDER BY one_rm DESC LIMIT 1', [ex.exerciseId]);
      if (existing.length === 0 || new1RM > existing[0].one_rm) {
        await run('INSERT INTO personal_records (exercise_id, weight, reps, one_rm, workout_id, date) VALUES (?, ?, ?, ?, ?, ?)',
          [ex.exerciseId, best.weight, best.reps, new1RM, workoutId, params.date]);
      }
    }
  }

  return workoutId;
}

export async function getRecentWorkouts(limit = 20): Promise<(Workout & { exerciseCount: number; totalVolume: number })[]> {
  const rows = await query<any>(
    `SELECT w.*, COUNT(DISTINCT we.id) as exercise_count,
      COALESCE(SUM(CASE WHEN s.completed=1 AND s.is_warmup=0 AND s.reps IS NOT NULL AND s.weight IS NOT NULL THEN s.reps*s.weight ELSE 0 END),0) as total_volume
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id=w.id
    LEFT JOIN sets s ON s.workout_exercise_id=we.id
    GROUP BY w.id ORDER BY w.date DESC, w.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, date: r.date, duration: r.duration, notes: r.notes, createdAt: r.created_at, exerciseCount: r.exercise_count, totalVolume: Math.round(r.total_volume) }));
}

export interface WorkoutExerciseDetail {
  id: number; workoutId: number; exerciseId: number; orderIndex: number;
  exerciseName: string; muscleGroup: string; sets: WorkoutSet[];
}

export async function getWorkoutDetail(workoutId: number): Promise<{ workout: Workout; exercises: WorkoutExerciseDetail[] }> {
  const rows = await query<any>('SELECT * FROM workouts WHERE id = ?', [workoutId]);
  if (rows.length === 0) throw new Error('Workout not found');
  const row = rows[0];

  const wes = await query<any>(
    `SELECT we.*, e.name as exercise_name, e.muscle_group FROM workout_exercises we
     JOIN exercises e ON e.id=we.exercise_id WHERE we.workout_id=? ORDER BY we.order_index`,
    [workoutId]
  );

  const exercises: WorkoutExerciseDetail[] = [];
  for (const we of wes) {
    const sets = await query<any>('SELECT * FROM sets WHERE workout_exercise_id=? ORDER BY set_number', [we.id]);
    exercises.push({ id: we.id, workoutId: we.workout_id, exerciseId: we.exercise_id, orderIndex: we.order_index, exerciseName: we.exercise_name, muscleGroup: we.muscle_group, sets: sets.map(mapSet) });
  }

  return { workout: { id: row.id, name: row.name, date: row.date, duration: row.duration, notes: row.notes, createdAt: row.created_at }, exercises };
}

// ─── Exercise history ─────────────────────────────────────────────────────────

export async function getExerciseHistory(exerciseId: number): Promise<{
  date: string; workoutId: number; workoutName: string | null;
  sets: WorkoutSet[]; totalVolume: number; bestWeight: number; estimatedOneRM: number;
}[]> {
  const wes = await query<any>(
    `SELECT we.*, w.date, w.name as workout_name FROM workout_exercises we
     JOIN workouts w ON w.id=we.workout_id WHERE we.exercise_id=? ORDER BY w.date ASC, w.created_at ASC`,
    [exerciseId]
  );

  const history = [];
  for (const we of wes) {
    const sets = (await query<any>('SELECT * FROM sets WHERE workout_exercise_id=? ORDER BY set_number', [we.id])).map(mapSet);
    const working = sets.filter((s) => s.completed && !s.isWarmup && s.reps && s.weight);
    history.push({
      date: we.date, workoutId: we.workout_id, workoutName: we.workout_name, sets,
      totalVolume: Math.round(working.reduce((sum, s) => sum + s.reps! * s.weight!, 0)),
      bestWeight: working.length > 0 ? Math.max(...working.map((s) => s.weight!)) : 0,
      estimatedOneRM: working.length > 0 ? Math.max(...working.map((s) => estimateOneRM(s.weight!, s.reps!))) : 0,
    });
  }
  return history;
}

export async function getLastWorkoutSets(exerciseId: number): Promise<WorkoutSet[]> {
  const wes = await query<any>(
    `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id=we.workout_id
     WHERE we.exercise_id=? ORDER BY w.date DESC, w.created_at DESC LIMIT 1`,
    [exerciseId]
  );
  if (wes.length === 0) return [];
  return (await query<any>('SELECT * FROM sets WHERE workout_exercise_id=? ORDER BY set_number', [wes[0].id])).map(mapSet);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAllPersonalRecords(): Promise<(PersonalRecord & { exerciseName: string; muscleGroup: string })[]> {
  const rows = await query<any>(
    `SELECT pr.*, e.name as exercise_name, e.muscle_group FROM personal_records pr
     JOIN exercises e ON e.id=pr.exercise_id
     WHERE pr.one_rm=(SELECT MAX(one_rm) FROM personal_records pr2 WHERE pr2.exercise_id=pr.exercise_id)
     ORDER BY e.muscle_group, e.name`
  );
  return rows.map((r) => ({ id: r.id, exerciseId: r.exercise_id, weight: r.weight, reps: r.reps, oneRM: r.one_rm, workoutId: r.workout_id, date: r.date, exerciseName: r.exercise_name, muscleGroup: r.muscle_group }));
}

export async function getWeeklyVolume(): Promise<{ week: string; volume: number; count: number }[]> {
  const rows = await query<any>(
    `SELECT strftime('%Y-W%W',w.date) as week, COUNT(DISTINCT w.id) as count,
      COALESCE(SUM(CASE WHEN s.completed=1 AND s.is_warmup=0 AND s.reps IS NOT NULL AND s.weight IS NOT NULL THEN s.reps*s.weight ELSE 0 END),0) as volume
    FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id=w.id LEFT JOIN sets s ON s.workout_exercise_id=we.id
    WHERE w.date>=date('now','-84 days') GROUP BY week ORDER BY week ASC`
  );
  return rows.map((r) => ({ week: r.week, volume: Math.round(r.volume), count: r.count }));
}

export async function getTotalStats(): Promise<{ totalWorkouts: number; totalVolume: number; totalSets: number }> {
  const r1 = await query<{ c: number }>('SELECT COUNT(*) as c FROM workouts');
  const r2 = await query<{ v: number }>('SELECT COALESCE(SUM(CASE WHEN completed=1 AND is_warmup=0 AND reps IS NOT NULL AND weight IS NOT NULL THEN reps*weight ELSE 0 END),0) as v FROM sets');
  const r3 = await query<{ c: number }>('SELECT COUNT(*) as c FROM sets WHERE completed=1 AND is_warmup=0');
  return { totalWorkouts: r1[0]?.c ?? 0, totalVolume: Math.round(r2[0]?.v ?? 0), totalSets: r3[0]?.c ?? 0 };
}
