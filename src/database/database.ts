import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise, Workout, WorkoutSet, PersonalRecord, WorkoutTemplate, BestSet } from '../types';
import { estimateOneRM } from '../utils/calculations';

// ─── ID generator ─────────────────────────────────────────────────────────────

let _nextId = Date.now();
function nextId(): number { return ++_nextId; }

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_EXERCISES = 'exercises';
const KEY_WORKOUTS = 'workouts';
const KEY_TEMPLATES = 'templates';
const KEY_REST_TIMER = 'restTimerSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface StoredWorkoutExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  trackingType?: 'weight' | 'time';
  orderIndex: number;
  sets: WorkoutSet[];
}

interface StoredWorkout {
  id: number;
  name: string | null;
  date: string;
  duration: number | null;
  createdAt: string;
  exercises: StoredWorkoutExercise[];
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: [string, string, Exercise['exerciseType'], ('weight' | 'time')?][] = [
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
  ['Planche', 'core', 'bodyweight', 'time'],
  ['Ab wheel', 'core', 'bodyweight'],
  ['Relevé de jambes', 'core', 'bodyweight'],
];

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  const exercises = await getJSON<Exercise[]>(KEY_EXERCISES, []);
  if (exercises.length === 0) {
    const seeded: Exercise[] = SEED.map(([name, muscleGroup, exerciseType, trackingType = 'weight'], i) => ({
      id: i + 1,
      name,
      muscleGroup,
      exerciseType,
      trackingType: trackingType as 'weight' | 'time',
      createdAt: new Date().toISOString(),
    }));
    await setJSON(KEY_EXERCISES, seeded);
    _nextId = Math.max(_nextId, SEED.length + 1);
  }
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function getAllExercises(): Promise<Exercise[]> {
  return getJSON<Exercise[]>(KEY_EXERCISES, []);
}

export async function createExercise(name: string, muscleGroup: string, exerciseType: string, trackingType: 'weight' | 'time' = 'weight'): Promise<Exercise> {
  const exercises = await getAllExercises();
  const exercise: Exercise = {
    id: nextId(),
    name,
    muscleGroup,
    exerciseType: exerciseType as Exercise['exerciseType'],
    trackingType,
    createdAt: new Date().toISOString(),
  };
  await setJSON(KEY_EXERCISES, [...exercises, exercise]);
  return exercise;
}

// ─── Save workout ─────────────────────────────────────────────────────────────

export async function saveWorkout(params: {
  name: string | null;
  date: string;
  duration: number;
  exercises: { exerciseId: number; sets: { reps: number | null; weight: number | null; duration?: number | null; isWarmup: boolean; completed: boolean; rpe?: number | null }[] }[];
}): Promise<number> {
  const allExercises = await getAllExercises();
  const exMap = new Map(allExercises.map((e) => [e.id, e]));

  const workoutId = nextId();
  const storedExercises: StoredWorkoutExercise[] = params.exercises.map((ex, i) => {
    const info = exMap.get(ex.exerciseId);
    const weId = nextId();
    return {
      id: weId,
      exerciseId: ex.exerciseId,
      exerciseName: info?.name ?? '',
      muscleGroup: info?.muscleGroup ?? 'other',
      trackingType: info?.trackingType ?? 'weight',
      orderIndex: i,
      sets: ex.sets.map((s, j) => ({
        id: nextId(),
        workoutExerciseId: weId,
        setNumber: j + 1,
        reps: s.reps,
        weight: s.weight,
        duration: s.duration ?? null,
        isWarmup: s.isWarmup,
        completed: s.completed,
        rpe: s.rpe ?? null,
      })),
    };
  });

  const workout: StoredWorkout = {
    id: workoutId,
    name: params.name,
    date: params.date,
    duration: params.duration,
    createdAt: new Date().toISOString(),
    exercises: storedExercises,
  };

  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  await setJSON(KEY_WORKOUTS, [workout, ...workouts]);
  return workoutId;
}

// ─── Recent workouts ──────────────────────────────────────────────────────────

export async function getRecentWorkouts(limit = 20): Promise<(Workout & { exerciseCount: number; totalVolume: number })[]> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  return workouts.slice(0, limit).map((w) => {
    const totalVolume = w.exercises
      .flatMap((ex) => ex.sets)
      .filter((s) => s.completed && !s.isWarmup && s.reps != null && s.weight != null)
      .reduce((sum, s) => sum + s.reps! * s.weight!, 0);
    return {
      id: w.id,
      name: w.name,
      date: w.date,
      duration: w.duration,
      notes: null,
      createdAt: w.createdAt,
      exerciseCount: w.exercises.length,
      totalVolume: Math.round(totalVolume),
    };
  });
}

// ─── Workout detail ───────────────────────────────────────────────────────────

export interface WorkoutExerciseDetail {
  id: number;
  workoutId: number;
  exerciseId: number;
  orderIndex: number;
  exerciseName: string;
  muscleGroup: string;
  trackingType: 'weight' | 'time';
  sets: WorkoutSet[];
}

export async function getWorkoutDetail(workoutId: number): Promise<{ workout: Workout; exercises: WorkoutExerciseDetail[] }> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const w = workouts.find((x) => x.id === workoutId);
  if (!w) throw new Error('Workout not found');
  return {
    workout: { id: w.id, name: w.name, date: w.date, duration: w.duration, notes: null, createdAt: w.createdAt },
    exercises: w.exercises.map((ex) => ({
      id: ex.id, workoutId: w.id, exerciseId: ex.exerciseId,
      orderIndex: ex.orderIndex, exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      trackingType: ex.trackingType ?? 'weight',
      sets: ex.sets,
    })),
  };
}

// ─── Exercise history ─────────────────────────────────────────────────────────

export async function getExerciseHistory(exerciseId: number): Promise<{
  date: string; workoutId: number; workoutName: string | null;
  sets: WorkoutSet[]; totalVolume: number; bestWeight: number; estimatedOneRM: number;
}[]> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  return workouts
    .filter((w) => w.exercises.some((ex) => ex.exerciseId === exerciseId))
    .reverse()
    .map((w) => {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId)!;
      const working = ex.sets.filter((s) => s.completed && !s.isWarmup && s.reps != null && s.weight != null);
      return {
        date: w.date,
        workoutId: w.id,
        workoutName: w.name,
        sets: ex.sets,
        totalVolume: Math.round(working.reduce((sum, s) => sum + s.reps! * s.weight!, 0)),
        bestWeight: working.length > 0 ? Math.max(...working.map((s) => s.weight!)) : 0,
        estimatedOneRM: working.length > 0 ? Math.max(...working.map((s) => estimateOneRM(s.weight!, s.reps!))) : 0,
      };
    });
}

export async function getLastWorkoutSets(exerciseId: number): Promise<WorkoutSet[]> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const last = workouts.find((w) => w.exercises.some((ex) => ex.exerciseId === exerciseId));
  if (!last) return [];
  return last.exercises.find((ex) => ex.exerciseId === exerciseId)?.sets ?? [];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAllPersonalRecords(): Promise<(PersonalRecord & { exerciseName: string; muscleGroup: string })[]> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const best = new Map<number, { oneRM: number; weight: number; reps: number; date: string; workoutId: number; exerciseName: string; muscleGroup: string }>();

  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets.filter((s) => s.completed && !s.isWarmup && s.reps != null && s.weight != null)) {
        const orm = estimateOneRM(s.weight!, s.reps!);
        if (!best.has(ex.exerciseId) || orm > best.get(ex.exerciseId)!.oneRM) {
          best.set(ex.exerciseId, { oneRM: orm, weight: s.weight!, reps: s.reps!, date: w.date, workoutId: w.id, exerciseName: ex.exerciseName, muscleGroup: ex.muscleGroup });
        }
      }
    }
  }

  return [...best.entries()].map(([exerciseId, data], i) => ({
    id: i + 1, exerciseId, weight: data.weight, reps: data.reps, oneRM: data.oneRM,
    workoutId: data.workoutId, date: data.date, exerciseName: data.exerciseName, muscleGroup: data.muscleGroup,
  }));
}

export async function getWeeklyVolume(): Promise<{ week: string; volume: number; count: number }[]> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const cutoff = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000);
  const weekMap = new Map<string, { volume: number; count: number }>();

  for (const w of workouts) {
    const d = new Date(w.date);
    if (d < cutoff) continue;
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const week = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const vol = w.exercises
      .flatMap((ex) => ex.sets)
      .filter((s) => s.completed && !s.isWarmup && s.reps != null && s.weight != null)
      .reduce((sum, s) => sum + s.reps! * s.weight!, 0);
    const prev = weekMap.get(week) ?? { volume: 0, count: 0 };
    weekMap.set(week, { volume: prev.volume + Math.round(vol), count: prev.count + 1 });
  }

  return [...weekMap.entries()]
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getTotalStats(): Promise<{ totalWorkouts: number; totalVolume: number; totalSets: number }> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  let totalVolume = 0;
  let totalSets = 0;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.completed && !s.isWarmup) {
          totalSets++;
          if (s.reps != null && s.weight != null) totalVolume += s.reps * s.weight;
        }
      }
    }
  }
  return { totalWorkouts: workouts.length, totalVolume: Math.round(totalVolume), totalSets };
}

// ─── Exercise best set ─────────────────────────────────────────────────────────

export async function getExerciseBest(exerciseId: number): Promise<BestSet | undefined> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  let best: BestSet | undefined;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (s.completed && !s.isWarmup && s.reps != null && s.weight != null) {
          const orm = estimateOneRM(s.weight, s.reps);
          if (!best || orm > best.oneRM) {
            best = { weight: s.weight, reps: s.reps, oneRM: orm };
          }
        }
      }
    }
  }
  return best;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  return getJSON<WorkoutTemplate[]>(KEY_TEMPLATES, []);
}

export async function saveTemplate(name: string, exerciseIds: number[]): Promise<void> {
  const templates = await getTemplates();
  const template: WorkoutTemplate = {
    id: nextId(),
    name,
    exerciseIds,
    createdAt: new Date().toISOString(),
  };
  await setJSON(KEY_TEMPLATES, [...templates, template]);
}

export async function deleteTemplate(id: number): Promise<void> {
  const templates = await getTemplates();
  await setJSON(KEY_TEMPLATES, templates.filter((t) => t.id !== id));
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  await setJSON(KEY_WORKOUTS, workouts.filter((w) => w.id !== workoutId));
}

export async function renameWorkout(workoutId: number, name: string | null): Promise<void> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const idx = workouts.findIndex((w) => w.id === workoutId);
  if (idx === -1) return;
  workouts[idx] = { ...workouts[idx], name };
  await setJSON(KEY_WORKOUTS, workouts);
}

export async function updateWorkoutSets(
  workoutId: number,
  exerciseId: number,
  sets: { id: number; weight: number | null; reps: number | null; duration?: number | null }[]
): Promise<void> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const wIdx = workouts.findIndex((w) => w.id === workoutId);
  if (wIdx === -1) return;
  const w = { ...workouts[wIdx] };
  w.exercises = w.exercises.map((ex) => {
    if (ex.exerciseId !== exerciseId) return ex;
    return {
      ...ex,
      sets: ex.sets.map((s) => {
        const upd = sets.find((u) => u.id === s.id);
        return upd ? { ...s, weight: upd.weight, reps: upd.reps, duration: upd.duration !== undefined ? upd.duration : s.duration } : s;
      }),
    };
  });
  workouts[wIdx] = w;
  await setJSON(KEY_WORKOUTS, workouts);
}

// ─── Rest timer settings ───────────────────────────────────────────────────────

export interface RestTimerSettings {
  enabled: boolean;
  durationSeconds: number;
}

export async function getRestTimerSettings(): Promise<RestTimerSettings> {
  return getJSON<RestTimerSettings>(KEY_REST_TIMER, { enabled: true, durationSeconds: 90 });
}

export async function saveRestTimerSettings(settings: RestTimerSettings): Promise<void> {
  await setJSON(KEY_REST_TIMER, settings);
}

// ─── Muscle heatmap ───────────────────────────────────────────────────────────

export async function getWeekMuscleActivity(): Promise<Record<string, number>> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result: Record<string, number> = {
    chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0, cardio: 0, other: 0,
  };
  for (const w of workouts) {
    const d = new Date(w.date);
    if (d < cutoff) continue;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.completed && !s.isWarmup) {
          const mg = ex.muscleGroup in result ? ex.muscleGroup : 'other';
          result[mg] = (result[mg] ?? 0) + 1;
        }
      }
    }
  }
  return result;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function exportWorkoutsCSV(): Promise<string> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const lines: string[] = ['Date,Séance,Exercice,Série,Poids (kg),Reps,Chauffe,Complété,RPE'];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        lines.push([
          w.date,
          `"${(w.name ?? '').replace(/"/g, '""')}"`,
          `"${ex.exerciseName.replace(/"/g, '""')}"`,
          s.setNumber,
          s.weight ?? '',
          s.reps ?? '',
          s.isWarmup ? 'Oui' : 'Non',
          s.completed ? 'Oui' : 'Non',
          (s as any).rpe ?? '',
        ].join(','));
      }
    }
  }
  return lines.join('\n');
}

// ─── Four-week muscle volume ───────────────────────────────────────────────────

export async function getFourWeekMuscleVolume(): Promise<Record<string, number>> {
  const workouts = await getJSON<StoredWorkout[]>(KEY_WORKOUTS, []);
  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const result: Record<string, number> = {};
  for (const w of workouts) {
    if (new Date(w.date) < cutoff) continue;
    for (const ex of w.exercises) {
      const vol = ex.sets
        .filter(s => s.completed && !s.isWarmup && s.reps != null && s.weight != null)
        .reduce((sum, s) => sum + s.reps! * s.weight!, 0);
      if (vol > 0) result[ex.muscleGroup] = (result[ex.muscleGroup] ?? 0) + vol;
    }
  }
  return result;
}
