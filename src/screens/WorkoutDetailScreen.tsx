import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { RootStackParamList, Workout, WorkoutSet } from '../types';
import { getWorkoutDetail, WorkoutExerciseDetail } from '../database/database';
import { formatDateFull, formatDuration, muscleGroupLabel, formatWeight } from '../utils/calculations';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;

export default function WorkoutDetailScreen() {
  const { params } = useRoute<Route>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExerciseDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkoutDetail(params.workoutId).then(({ workout, exercises }) => {
      setWorkout(workout);
      setExercises(exercises);
      setLoading(false);
    });
  }, [params.workoutId]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ flex: 1 }} />;
  if (!workout) return null;

  const totalVolume = exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.completed && !s.isWarmup && s.reps && s.weight)
    .reduce((sum, s) => sum + s.reps! * s.weight!, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.date}>{formatDateFull(workout.date)}</Text>
        {workout.name && <Text style={styles.name}>{workout.name}</Text>}
        <View style={styles.stats}>
          {workout.duration != null && (
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.statValue}>{formatDuration(workout.duration * 60)}</Text>
              <Text style={styles.statLabel}>durée</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Ionicons name="barbell-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.statValue}>{exercises.length}</Text>
            <Text style={styles.statLabel}>exercices</Text>
          </View>
          {totalVolume > 0 && (
            <View style={styles.stat}>
              <Ionicons name="trending-up-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.statValue}>{totalVolume.toLocaleString('fr')}</Text>
              <Text style={styles.statLabel}>kg total</Text>
            </View>
          )}
        </View>
      </View>

      {/* Exercises */}
      {exercises.map((ex) => {
        const workingSets = ex.sets.filter((s) => !s.isWarmup && s.completed);
        const warmupSets = ex.sets.filter((s) => s.isWarmup);
        const vol = workingSets
          .filter((s) => s.reps && s.weight)
          .reduce((sum, s) => sum + s.reps! * s.weight!, 0);

        return (
          <View key={ex.id} style={styles.exCard}>
            <View style={styles.exHeader}>
              <View style={[styles.dot, { backgroundColor: muscleColors[ex.muscleGroup] ?? '#888' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.exerciseName}</Text>
                <Text style={styles.exMuscle}>{muscleGroupLabel(ex.muscleGroup)}</Text>
              </View>
              {vol > 0 && <Text style={styles.exVol}>{Math.round(vol).toLocaleString('fr')} kg</Text>}
            </View>

            {/* Sets table */}
            <View style={styles.setHeader}>
              <Text style={[styles.setCell, { width: 28 }]}>#</Text>
              <Text style={[styles.setCell, { flex: 1 }]}>Poids</Text>
              <Text style={[styles.setCell, { flex: 1 }]}>Reps</Text>
            </View>
            {ex.sets.map((s, i) => (
              <View key={s.id} style={[styles.setRow, s.isWarmup && styles.setWarmup]}>
                <Text style={styles.setNum}>{s.isWarmup ? 'E' : i + 1 - warmupSets.filter((_, wi) => wi < i).length}</Text>
                <Text style={styles.setValue}>
                  {s.weight != null ? `${formatWeight(s.weight)} kg` : '—'}
                </Text>
                <Text style={styles.setValue}>{s.reps ?? '—'}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  summary: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  date: { fontSize: 13, color: theme.colors.textMuted, textTransform: 'capitalize', marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase' },
  exCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  exName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  exMuscle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  exVol: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
  setHeader: { flexDirection: 'row', marginBottom: 6 },
  setCell: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  setWarmup: { opacity: 0.5 },
  setNum: { width: 28, fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  setValue: { flex: 1, fontSize: 14, color: theme.colors.text },
});
