import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, Workout } from '../types';
import { getRecentWorkouts } from '../database/database';
import { formatDate, formatDuration } from '../utils/calculations';

type WorkoutItem = Workout & { exerciseCount: number; totalVolume: number };

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecentWorkouts(100).then((data) => {
        if (active) { setWorkouts(data); setLoading(false); }
      });
      return () => { active = false; };
    }, [])
  );

  // Group by month
  const grouped = workouts.reduce<{ title: string; data: WorkoutItem[] }[]>((acc, w) => {
    const d = new Date(w.date);
    const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.title === key) {
      last.data.push(w);
    } else {
      acc.push({ title: key, data: [w] });
    }
    return acc;
  }, []);

  const renderItem = ({ item }: { item: WorkoutItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        <Text style={styles.cardTitle}>{item.name ?? 'Séance'}</Text>
        <Text style={styles.cardSub}>
          {item.exerciseCount} exercice{item.exerciseCount !== 1 ? 's' : ''}
          {item.totalVolume > 0 ? ` · ${item.totalVolume.toLocaleString('fr')} kg` : ''}
          {item.duration ? ` · ${formatDuration(item.duration * 60)}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.pageTitle}>Historique</Text>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={56} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune séance enregistrée</Text>
          <Text style={styles.emptyText}>Tes séances apparaîtront ici une fois terminées.</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text style={styles.count}>{workouts.length} séance{workouts.length !== 1 ? 's' : ''}</Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  count: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flex: 1 },
  cardDate: { fontSize: 12, color: theme.colors.textMuted, textTransform: 'capitalize', marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 3 },
  cardSub: { fontSize: 13, color: theme.colors.textSecondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
