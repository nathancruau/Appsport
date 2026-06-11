import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, Workout } from '../types';
import { getRecentWorkouts } from '../database/database';
import { formatDate, formatDuration, muscleGroupLabel } from '../utils/calculations';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

type WorkoutItem = Workout & { exerciseCount: number; totalVolume: number };

export default function HomeScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRecentWorkouts(db, 10).then((data) => {
        if (active) {
          setWorkouts(data);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [db])
  );

  const thisWeekCount = workouts.filter((w) => {
    const d = new Date(w.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return d >= weekAgo;
  }).length;

  const renderWorkout = ({ item }: { item: WorkoutItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
          <Text style={styles.cardTitle}>{item.name ?? 'Séance'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </View>
      <View style={styles.cardStats}>
        <View style={styles.statChip}>
          <Ionicons name="barbell-outline" size={13} color={theme.colors.primary} />
          <Text style={styles.statText}>{item.exerciseCount} exercice{item.exerciseCount > 1 ? 's' : ''}</Text>
        </View>
        {item.totalVolume > 0 && (
          <View style={styles.statChip}>
            <Ionicons name="trending-up-outline" size={13} color={theme.colors.primary} />
            <Text style={styles.statText}>{item.totalVolume.toLocaleString('fr')} kg</Text>
          </View>
        )}
        {item.duration != null && (
          <View style={styles.statChip}>
            <Ionicons name="time-outline" size={13} color={theme.colors.primary} />
            <Text style={styles.statText}>{formatDuration(item.duration * 60)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour 💪</Text>
          <Text style={styles.subtitle}>
            {thisWeekCount > 0
              ? `${thisWeekCount} séance${thisWeekCount > 1 ? 's' : ''} cette semaine`
              : 'Prêt pour une séance ?'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => navigation.navigate('ActiveWorkout')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.startButtonText}>Nouvelle séance</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="fitness-outline" size={56} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune séance</Text>
          <Text style={styles.emptyText}>Lance ta première séance pour commencer à suivre tes progrès.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Séances récentes</Text>
          <FlatList
            data={workouts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderWorkout}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 56,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    marginBottom: theme.spacing.lg,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
