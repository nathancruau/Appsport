import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { version } from '../../package.json';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, Workout, WorkoutTemplate } from '../types';
import { getRecentWorkouts, getTemplates, deleteTemplate } from '../database/database';
import { formatDate, formatDuration, muscleGroupLabel } from '../utils/calculations';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

type WorkoutItem = Workout & { exerciseCount: number; totalVolume: number };

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getRecentWorkouts(10),
        getTemplates(),
      ]).then(([data, tmpl]) => {
        if (active) {
          setWorkouts(data);
          setTemplates(tmpl);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [])
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
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour 💪</Text>
          <Text style={styles.subtitle}>
            {thisWeekCount > 0
              ? `${thisWeekCount} séance${thisWeekCount > 1 ? 's' : ''} cette semaine`
              : 'Prêt pour une séance ?'}
          </Text>
        </View>
        <Text style={styles.versionText}>v{version}</Text>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => navigation.navigate('ActiveWorkout')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.startButtonText}>Nouvelle séance</Text>
      </TouchableOpacity>

      {templates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Démarrage rapide</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: theme.spacing.md }}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {templates.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.templateChip}
                onPress={() => navigation.navigate('ActiveWorkout', { templateExerciseIds: t.exerciseIds })}
                onLongPress={() => {
                  Alert.alert('Supprimer le template ?', `"${t.name}" sera supprimé.`, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: async () => {
                      await deleteTemplate(t.id);
                      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
                    }},
                  ]);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="flash" size={14} color={theme.colors.primary} />
                <Text style={styles.templateChipText}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

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
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  versionText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
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
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  templateChipText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
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
