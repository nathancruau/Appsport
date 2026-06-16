import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, WorkoutSet } from '../types';
import { getExerciseHistory } from '../database/database';
import { formatDate, formatWeight, estimateOneRM } from '../utils/calculations';

type Route = RouteProp<RootStackParamList, 'ExerciseDetail'>;

const { width } = Dimensions.get('window');

interface HistoryEntry {
  date: string;
  workoutId: number;
  workoutName: string | null;
  sets: WorkoutSet[];
  totalVolume: number;
  bestWeight: number;
  estimatedOneRM: number;
}

export default function ExerciseDetailScreen() {
  const { params } = useRoute<Route>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExerciseHistory(params.exerciseId).then((data) => {
      setHistory(data);
      setLoading(false);
    });
  }, [params.exerciseId]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ flex: 1, backgroundColor: theme.colors.background }} />;

  const recent = history.slice(0, 12).reverse(); // 12 plus récentes, ordre chronologique (gauche=ancien, droite=récent)
  const pr = history.length > 0 ? Math.max(...history.map((h) => h.estimatedOneRM)) : 0;
  const bestWeight = history.length > 0 ? Math.max(...history.map((h) => h.bestWeight)) : 0;
  const lastEntry = history[0]; // plus récente (history est newest-first)

  const chartData = recent.length >= 2 ? {
    labels: recent.map((h) => {
      const d = new Date(h.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [{ data: recent.map((h) => h.estimatedOneRM || h.bestWeight || 0) }],
  } : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* PR Summary */}
      <View style={styles.prRow}>
        <View style={styles.prCard}>
          <Text style={styles.prLabel}>1RM estimé</Text>
          <Text style={styles.prValue}>{pr > 0 ? `${pr} kg` : '—'}</Text>
        </View>
        <View style={styles.prCard}>
          <Text style={styles.prLabel}>Meilleur poids</Text>
          <Text style={styles.prValue}>{bestWeight > 0 ? `${formatWeight(bestWeight)} kg` : '—'}</Text>
        </View>
        <View style={styles.prCard}>
          <Text style={styles.prLabel}>Séances</Text>
          <Text style={styles.prValue}>{history.length}</Text>
        </View>
      </View>

      {/* Progress chart */}
      {chartData && (
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Progression (1RM estimé)</Text>
          <LineChart
            data={chartData}
            width={width - 32}
            height={180}
            yAxisSuffix=" kg"
            chartConfig={{
              backgroundColor: theme.colors.card,
              backgroundGradientFrom: theme.colors.card,
              backgroundGradientTo: theme.colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
              labelColor: () => theme.colors.textMuted,
              style: { borderRadius: theme.radius.md },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: theme.colors.primary,
              },
            }}
            bezier
            style={{ borderRadius: theme.radius.md }}
            withShadow={false}
          />
        </View>
      )}

      {/* Last workout */}
      {lastEntry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dernière séance — {formatDate(lastEntry.date)}</Text>
          {lastEntry.sets.filter((s) => !s.isWarmup).map((s, i) => (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setNum}>{i + 1}</Text>
              <Text style={styles.setValue}>{s.weight != null ? `${formatWeight(s.weight)} kg` : '—'}</Text>
              <Text style={styles.setValue}>{s.reps != null ? `${s.reps} reps` : '—'}</Text>
              {s.weight && s.reps && (
                <Text style={styles.setOneRM}>1RM ≈ {estimateOneRM(s.weight, s.reps)} kg</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historique ({history.length} séances)</Text>
        {[...history].reverse().map((entry, idx) => (
          <View key={`${entry.workoutId}-${idx}`} style={styles.histCard}>
            <Text style={styles.histDate}>{formatDate(entry.date)}</Text>
            <View style={styles.histSets}>
              {entry.sets.filter((s) => !s.isWarmup && s.completed).map((s, i) => (
                <Text key={s.id} style={styles.histSet}>
                  {s.weight != null ? `${formatWeight(s.weight)} kg` : '—'} × {s.reps ?? '—'}
                </Text>
              ))}
            </View>
            {entry.totalVolume > 0 && (
              <Text style={styles.histVol}>{entry.totalVolume.toLocaleString('fr')} kg de volume</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  prRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  prCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: 'center',
  },
  prLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  prValue: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  chartSection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  section: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  setNum: { width: 24, fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  setValue: { width: 80, fontSize: 14, color: theme.colors.text },
  setOneRM: { flex: 1, fontSize: 12, color: theme.colors.primary, textAlign: 'right' },
  histCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: theme.spacing.sm,
  },
  histDate: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 6 },
  histSets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  histSet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    color: theme.colors.text,
  },
  histVol: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
});
