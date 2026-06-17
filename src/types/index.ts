export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string;
  exerciseType: 'strength' | 'cardio' | 'bodyweight';
  trackingType?: 'weight' | 'time';
  isDefault?: boolean;
  createdAt: string;
}

export interface Workout {
  id: number;
  name: string | null;
  date: string;
  duration: number | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkoutExercise {
  id: number;
  workoutId: number;
  exerciseId: number;
  orderIndex: number;
}

export interface WorkoutSet {
  id: number;
  workoutExerciseId: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  isWarmup: boolean;
  completed: boolean;
  rpe?: number | null;
}

export interface PersonalRecord {
  id: number;
  exerciseId: number;
  weight: number | null;
  reps: number | null;
  oneRM: number | null;
  workoutId: number | null;
  date: string;
}

// Active workout (in-memory during a session)
export interface ActiveSet {
  reps: string;
  weight: string;
  duration: string;
  isWarmup: boolean;
  completed: boolean;
  rpe: string;
}

export interface BestSet {
  weight: number;
  reps: number;
  oneRM: number;
}

export interface ActiveExercise {
  exercise: Exercise;
  sets: ActiveSet[];
  previousSets: WorkoutSet[];
  bestSet?: BestSet;
  isSuperset?: boolean;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  exerciseIds: number[];
  createdAt: string;
}

export interface ActiveWorkout {
  name: string;
  startTime: Date;
  exercises: ActiveExercise[];
}

export type RootStackParamList = {
  Main: undefined;
  ActiveWorkout: { templateExerciseIds?: number[]; workoutName?: string } | undefined;
  WorkoutDetail: { workoutId: number };
  ExerciseDetail: { exerciseId: number; exerciseName: string };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Exercises: undefined;
  Stats: undefined;
};
