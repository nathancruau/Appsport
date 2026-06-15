import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { PersonalRecord } from '../types';
import { getAllPersonalRecords, getWeeklyVolume, getTotalStats } from '../database/database';
import { muscleGroupLabel, formatDate, formatWeight } from '../utils/calculations';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [prs, setPrs] = useState<(PersonalRecord & { exerciseName: string; muscleGroup: string })[]>([]);
  const [weeklyVol, setWeeklyVol] = useState<{ week: string; volume: number; count: number }[]>([]);
  const [totals, setTotals] = useState({ totalWorkouts: 0, totalVolume: 0, totalSets: 0 });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getAllPersonalRecords(),
        getWeeklyVolume(),
        getTotalStats(),
      ]).then(([p, w, t]) => {
        if (active) {
          setPrs(p);
          setWeeklyVol(w);
          setTotals(t);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [])
  );

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ flex: 1, backgroundColor: theme.colors.background }} />;

  const hasData = totals.totalWorkouts > 0;

  // Chart data — last 8 weeks
  const chartWeeks = weeklyVol.slice(-8);
  const chartData = chartWeeks.length >= 2 ? {
    labels: chartWeeks.map((w) => {
      const parts = w.week.split('-W');
      return `S${parts[1]}`;
    }),
    datasets: [{ data: chartWeeks.map((w) => w.volume) }],
  } : null;

  // Group PRs by muscle
  const prByMuscle = prs.reduce<Record<string, typeof prs>>((acc, pr) => {
    const g = pr.muscleGroup;
    if (!acc[g]) acc[g] = [];
    acc[g].push(pr);
    return acc;
  }, {});

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Statistiques</Text>

      {!hasData ? (
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={56} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Pas encore de données</Text>
          <Text style={styles.emptyText}>Enregistre des séances pour voir tes stats ici.</Text>
        </View>
      ) : (
        <>
          {/* Global totals */}
          <View style={styles.totalsRow}>
            <View style={styles.totalCard}>
              <Text style={styles.totalVal}>{totals.totalWorkouts}</Text>
              <Text style={styles.totalLabel}>Séances</Text>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalVal}>{(totals.totalVolume / 1000).toFixed(1)}t</Text>
              <Text style={styles.totalLabel}>Volume total</Text>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalVal}>{totals.totalSets}</Text>
              <Text style={styles.totalLabel}>Séries</Text>
            </View>
          </View>

          {/* Weekly volume chart */}
          {chartData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volume hebdomadaire</Text>
              <BarChart
                data={chartData}
                width={width - 32}
                height={180}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(26, 26, 26, ${opacity})`,
                  labelColor: () => theme.colors.textSecondary,
                  barPercentage: 0.6,
                }}
                style={{ borderRadius: theme.radius.md }}
                showValuesOnTopOfBars={false}
                fromZero
              />
              <Text style={styles.chartNote}>Volume en kg (séries de travail uniquement)</Text>
            </View>
          )}

          {/* Personal Records */}
          {prs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Records personnels</Text>
              {Object.entries(prByMuscle).map(([muscle, records]) => (
                <View key={muscle} style={styles.prGroup}>
                  <View style={styles.prGroupHeader}>
                    <View style={[styles.dot, { backgroundColor: muscleColors[muscle] ?? '#888' }]} />
                    <Text style={styles.prGroupTitle}>{muscleGroupLabel(muscle)}</Text>
                  </View>
                  {records.map((pr) => (
                    <View key={pr.id} style={styles.prRow}>
                      <Text style={styles.prName}>{pr.exerciseName}</Text>
                      <View style={styles.prRight}>
                        {pr.weight && pr.reps && (
                          <Text style={styles.prDetail}>{formatWeight(pr.weight)} kg × {pr.reps}</Text>
                        )}
                        {pr.oneRM && (
                          <Text style={styles.prOneRM}>1RM ≈ {pr.oneRM} kg</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  pageTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
  totalsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  totalCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
  },
  totalVal: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, marginBottom: 2 },
  totalLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase' },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  chartNote: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 },
  prGroup: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  prGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: theme.colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  prGroupTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  prName: { flex: 1, fontSize: 14, color: theme.colors.text },
  prRight: { alignItems: 'flex-end', gap: 2 },
  prDetail: { fontSize: 13, color: theme.colors.textSecondary },
  prOneRM: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
