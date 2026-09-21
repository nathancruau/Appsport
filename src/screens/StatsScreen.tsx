import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { PersonalRecord, RootStackParamList } from '../types';
import { getAllPersonalRecords, getWeeklyVolume, getTotalStats, getWeekMuscleActivity, exportWorkoutsCSV, getFourWeekMuscleVolume, getPRTimeline, PREvent, getTrainingCalendar } from '../database/database';
import { muscleGroupLabel, formatDate, formatWeight } from '../utils/calculations';

const { width } = Dimensions.get('window');

// ─── Calendar heatmap ─────────────────────────────────────────────────────────

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function buildMonthWeeks(year: number, month: number): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Mon=0
  for (let i = 0; i < offset; i++) week.push(null);
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    week.push(new Date(d));
    if (week.length === 7) { weeks.push(week); week = []; }
    d.setDate(d.getDate() + 1);
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

function CalendarHeatmap({
  data, year, month, onPrev, onNext, onDayPress,
}: {
  data: { date: string; volume: number; count: number; workoutId: number }[];
  year: number; month: number;
  onPrev: () => void; onNext: () => void;
  onDayPress: (workoutId: number) => void;
}) {
  const dayMap = new Map(data.map((d) => [d.date, d]));
  const maxVol = data.length > 0 ? Math.max(...data.map((d) => d.volume)) : 1;
  const cellSize = Math.floor((width - 32 - 6 * 2) / 7);
  const weeks = buildMonthWeeks(year, month);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const isNewest = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());

  return (
    <View>
      <View style={calStyles.navRow}>
        <TouchableOpacity onPress={onPrev} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={onNext} disabled={isNewest} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={18} color={isNewest ? theme.colors.textMuted + '40' : theme.colors.text} />
        </TouchableOpacity>
      </View>
      <View style={calStyles.dayHeaders}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={[calStyles.cell, { width: cellSize, height: 20 }]}>
            <Text style={calStyles.dayLabel}>{d}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={[calStyles.cell, { width: cellSize, height: cellSize }]} />;
            const dateStr = day.toISOString().slice(0, 10);
            const entry = dayMap.get(dateStr);
            const isToday = dateStr === today;
            const opacity = entry ? Math.max(0.25, entry.volume / maxVol) : 0;
            return (
              <TouchableOpacity
                key={di}
                style={[
                  calStyles.cell,
                  { width: cellSize, height: cellSize },
                  calStyles.dayCell,
                  entry ? { backgroundColor: `rgba(26, 26, 26, ${opacity})` } : null,
                  isToday ? calStyles.todayCell : null,
                ]}
                onPress={() => entry && onDayPress(entry.workoutId)}
                activeOpacity={entry ? 0.7 : 1}
              >
                <Text style={[calStyles.dayNum, entry ? calStyles.dayNumActive : null, isToday ? calStyles.dayNumToday : null]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text, textTransform: 'capitalize' },
  dayHeaders: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  dayLabel: { fontSize: 9, fontWeight: '700', color: '#999', textAlign: 'center' },
  weekRow: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  cell: { gap: 0, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderRadius: 6, backgroundColor: '#F0F0F0' },
  todayCell: { borderWidth: 1.5, borderColor: '#1A1A1A' },
  dayNum: { fontSize: 10, fontWeight: '500', color: '#999' },
  dayNumActive: { color: '#fff', fontWeight: '700' },
  dayNumToday: { color: '#1A1A1A' },
});

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [prs, setPrs] = useState<(PersonalRecord & { exerciseName: string; muscleGroup: string })[]>([]);
  const [weeklyVol, setWeeklyVol] = useState<{ week: string; volume: number; count: number }[]>([]);
  const [totals, setTotals] = useState({ totalWorkouts: 0, totalVolume: 0, totalSets: 0 });
  const [muscleActivity, setMuscleActivity] = useState<Record<string, number>>({});
  const [muscleVolume, setMuscleVolume] = useState<Record<string, number>>({});
  const [prTimeline, setPrTimeline] = useState<PREvent[]>([]);
  const [calendarData, setCalendarData] = useState<{ date: string; volume: number; count: number; workoutId: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [showAllPR, setShowAllPR] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getAllPersonalRecords(),
        getWeeklyVolume(),
        getTotalStats(),
        getWeekMuscleActivity(),
        getFourWeekMuscleVolume(),
        getPRTimeline(),
        getTrainingCalendar(),
      ]).then(([p, w, t, m, mv, tl, cal]) => {
        if (active) {
          setPrs(p);
          setWeeklyVol(w);
          setTotals(t);
          setMuscleActivity(m);
          setMuscleVolume(mv);
          setPrTimeline(tl);
          setCalendarData(cal);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [])
  );

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ flex: 1, backgroundColor: theme.colors.background }} />;

  const hasData = totals.totalWorkouts > 0;

  const handleExport = async () => {
    try {
      const csv = await exportWorkoutsCSV();
      if (typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appsport-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Export', 'Disponible uniquement sur web pour le moment.');
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'exporter les données.");
    }
  };

  const navigateCalMonth = (dir: -1 | 1) => {
    const d = new Date(calMonth.year, calMonth.month + dir, 1);
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

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

  // Muscle heatmap data
  const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'] as const;
  const maxSets = Math.max(...MUSCLE_GROUPS.map((mg) => muscleActivity[mg] ?? 0), 1);

  const visiblePR = showAllPR ? prTimeline : prTimeline.slice(0, 10);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Statistiques</Text>
        <TouchableOpacity onPress={handleExport} style={styles.exportBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="download-outline" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Muscle heatmap - always shown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cette semaine</Text>
        <View style={styles.muscleBubbleGrid}>
          {MUSCLE_GROUPS.map((mg) => {
            const sets = muscleActivity[mg] ?? 0;
            const opacity = sets === 0 ? 0.2 : Math.min(0.2 + (sets / Math.max(maxSets, 15)) * 0.8, 1);
            const size = sets === 0 ? 40 : Math.min(40 + (sets / Math.max(maxSets, 15)) * 16, 56);
            const color = muscleColors[mg] ?? '#888';
            return (
              <View key={mg} style={styles.muscleBubbleContainer}>
                <View style={[styles.muscleBubble, { width: size, height: size, backgroundColor: color, opacity, borderRadius: size / 2 }]} />
                <Text style={styles.muscleBubbleLabel}>{muscleGroupLabel(mg)}</Text>
                <Text style={styles.muscleBubbleCount}>{sets}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Calendar — toggle button */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Calendrier</Text>
          <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.toggleBtn}>
            <Text style={styles.toggleBtnText}>{showCalendar ? 'Masquer' : 'Afficher'}</Text>
            <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={13} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {showCalendar && (
          <CalendarHeatmap
            data={calendarData}
            year={calMonth.year}
            month={calMonth.month}
            onPrev={() => navigateCalMonth(-1)}
            onNext={() => navigateCalMonth(1)}
            onDayPress={(workoutId) => navigation.navigate('WorkoutDetail', { workoutId })}
          />
        )}
      </View>

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

          {/* Muscle volume 4 weeks */}
          {Object.values(muscleVolume).some(v => v > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volume par muscle — 4 semaines</Text>
              {Object.entries(muscleVolume).filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a).map(([mg, vol]) => {
                const max = Math.max(...Object.values(muscleVolume));
                const pct = max > 0 ? vol / max : 0;
                const color = muscleColors[mg] ?? '#888';
                return (
                  <View key={mg} style={styles.muscleBarRow}>
                    <View style={[styles.muscleDot, { backgroundColor: color }]} />
                    <Text style={styles.muscleBarLabel}>{muscleGroupLabel(mg)}</Text>
                    <View style={styles.muscleBarTrack}>
                      <View style={[styles.muscleBarFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.muscleBarVol}>{Math.round(vol / 1000)}t</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Weekly volume chart */}
          {chartData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volume hebdomadaire</Text>
              <LineChart
                data={chartData}
                width={width - 32}
                height={180}
                yAxisSuffix=" kg"
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
                bezier
                withShadow={false}
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
                    <TouchableOpacity
                      key={pr.id}
                      style={styles.prRow}
                      onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: pr.exerciseId, exerciseName: pr.exerciseName })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.prNameRow}>
                        <Text style={styles.prName}>{pr.exerciseName}</Text>
                        <Ionicons name="chevron-forward" size={13} color={theme.colors.textMuted} />
                      </View>
                      <View style={styles.prRight}>
                        {pr.weight && pr.reps && (
                          <Text style={styles.prDetail}>{formatWeight(pr.weight)} kg × {pr.reps}</Text>
                        )}
                        {pr.oneRM && (
                          <Text style={styles.prOneRM}>1RM ≈ {pr.oneRM} kg</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* PR Timeline — bottom, max 10, expand button */}
          {prTimeline.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Historique des records</Text>
                {prTimeline.length > 10 && (
                  <TouchableOpacity onPress={() => setShowAllPR(!showAllPR)} style={styles.toggleBtn}>
                    <Text style={styles.toggleBtnText}>{showAllPR ? 'Réduire' : `Voir tout (${prTimeline.length})`}</Text>
                    <Ionicons name={showAllPR ? 'chevron-up' : 'chevron-down'} size={13} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {visiblePR.map((ev, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.timelineRow}
                  onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ev.exerciseId, exerciseName: ev.exerciseName })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.timelineDot, { backgroundColor: muscleColors[ev.muscleGroup] ?? '#888' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineName}>{ev.exerciseName}</Text>
                    <Text style={styles.timelineDate}>{formatDate(ev.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.timelineSet}>{ev.weight} kg × {ev.reps}</Text>
                    <Text style={styles.timelineOrm}>1RM ≈ {ev.oneRM} kg</Text>
                  </View>
                </TouchableOpacity>
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  pageTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text },
  exportBtn: { padding: 4 },
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
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  toggleBtnText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
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
  prNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  prName: { fontSize: 14, color: theme.colors.text, flex: 1 },
  prRight: { alignItems: 'flex-end', gap: 2 },
  prDetail: { fontSize: 13, color: theme.colors.textSecondary },
  prOneRM: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  // Muscle volume bars
  muscleBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  muscleBarLabel: { width: 72, fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  muscleBarTrack: { flex: 1, height: 8, backgroundColor: theme.colors.inputBackground, borderRadius: 4, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 4 },
  muscleBarVol: { width: 36, fontSize: 11, color: theme.colors.textMuted, textAlign: 'right' },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  timelineDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
  timelineSet: { fontSize: 13, color: theme.colors.textSecondary },
  timelineOrm: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  // Muscle heatmap (grille fixe 4×2)
  muscleBubbleGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, gap: 0 },
  muscleBubbleContainer: { alignItems: 'center', gap: 4, width: '25%', paddingVertical: 8 },
  muscleBubble: { marginBottom: 2 },
  muscleBubbleLabel: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  muscleBubbleCount: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center' },
});
