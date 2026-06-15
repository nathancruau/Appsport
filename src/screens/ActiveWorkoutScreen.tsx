import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView,
  Platform, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme, muscleColors } from '../theme';
import { Exercise, ActiveExercise, ActiveSet, WorkoutSet } from '../types';
import { getAllExercises, getLastWorkoutSets, saveWorkout } from '../database/database';
import { formatDuration, todayISO, muscleGroupLabel, estimateOneRM } from '../utils/calculations';

// ─── State management ────────────────────────────────────────────────────────

type State = {
  name: string;
  exercises: ActiveExercise[];
  elapsedSeconds: number;
  showPicker: boolean;
};

type Action =
  | { type: 'SET_NAME'; value: string }
  | { type: 'ADD_EXERCISE'; exercise: Exercise; previousSets: WorkoutSet[] }
  | { type: 'REMOVE_EXERCISE'; index: number }
  | { type: 'ADD_SET'; ei: number }
  | { type: 'REMOVE_SET'; ei: number; si: number }
  | { type: 'UPDATE_SET'; ei: number; si: number; field: 'reps' | 'weight'; value: string }
  | { type: 'TOGGLE_COMPLETE'; ei: number; si: number }
  | { type: 'TICK' }
  | { type: 'TOGGLE_PICKER' };

function makeEmptySet(prev?: WorkoutSet): ActiveSet {
  return {
    reps: prev?.reps != null ? String(prev.reps) : '',
    weight: prev?.weight != null ? String(prev.weight) : '',
    isWarmup: false,
    completed: false,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'ADD_EXERCISE': {
      const prevSets = action.previousSets.filter((s) => !s.isWarmup && s.completed);
      const sets = prevSets.length > 0
        ? prevSets.map((s) => makeEmptySet(s))
        : [makeEmptySet()];
      return {
        ...state,
        exercises: [...state.exercises, { exercise: action.exercise, sets, previousSets: action.previousSets }],
        showPicker: false,
      };
    }
    case 'REMOVE_EXERCISE':
      return { ...state, exercises: state.exercises.filter((_, i) => i !== action.index) };
    case 'ADD_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, makeEmptySet({ reps: lastSet ? Number(lastSet.reps) || null : null, weight: lastSet ? Number(lastSet.weight) || null : null } as any)];
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'REMOVE_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      ex.sets = ex.sets.filter((_, i) => i !== action.si);
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'UPDATE_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const sets = [...ex.sets];
      sets[action.si] = { ...sets[action.si], [action.field]: action.value };
      ex.sets = sets;
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'TOGGLE_COMPLETE': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const sets = [...ex.sets];
      sets[action.si] = { ...sets[action.si], completed: !sets[action.si].completed };
      ex.sets = sets;
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'TICK':
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case 'TOGGLE_PICKER':
      return { ...state, showPicker: !state.showPicker };
    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen({ navigation }: any) {
  const [state, dispatch] = useReducer(reducer, {
    name: '',
    exercises: [],
    elapsedSeconds: 0,
    showPicker: false,
  });
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAllExercises().then(setAllExercises);
    timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const addExercise = useCallback(async (exercise: Exercise) => {
    const prev = await getLastWorkoutSets(exercise.id);
    dispatch({ type: 'ADD_EXERCISE', exercise, previousSets: prev });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishWorkout = async () => {
    if (state.exercises.length === 0) {
      Alert.alert('Séance vide', 'Ajoute au moins un exercice avant de terminer.');
      return;
    }

    const totalSets = state.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length;
    if (totalSets === 0) {
      Alert.alert('Aucune série complétée', 'Coche au moins une série avant de terminer.');
      return;
    }

    Alert.alert('Terminer la séance ?', `${state.exercises.length} exercice(s) · ${formatDuration(state.elapsedSeconds)}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        style: 'default',
        onPress: async () => {
          setSaving(true);
          try {
            const durationMin = Math.round(state.elapsedSeconds / 60);
            await saveWorkout({
              name: state.name.trim() || null,
              date: todayISO(),
              duration: durationMin,
              exercises: state.exercises.map((ae) => ({
                exerciseId: ae.exercise.id,
                sets: ae.sets.map((s) => ({
                  reps: s.reps ? Number(s.reps) : null,
                  weight: s.weight ? Number(s.weight) : null,
                  isWarmup: s.isWarmup,
                  completed: s.completed,
                })),
              })),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de sauvegarder la séance.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const confirmDiscard = () => {
    if (state.exercises.length === 0) { navigation.goBack(); return; }
    Alert.alert('Abandonner la séance ?', 'Tes données non sauvegardées seront perdues.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // Group exercises for picker
  const filteredExercises = allExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    muscleGroupLabel(e.muscleGroup).toLowerCase().includes(search.toLowerCase())
  );
  const addedIds = new Set(state.exercises.map((e) => e.exercise.id));
  const sections = Object.entries(
    filteredExercises.reduce<Record<string, Exercise[]>>((acc, ex) => {
      const g = ex.muscleGroup;
      if (!acc[g]) acc[g] = [];
      acc[g].push(ex);
      return acc;
    }, {})
  ).map(([title, data]) => ({ title, data }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={confirmDiscard} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.timerBox}>
          <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.timer}>{formatDuration(state.elapsedSeconds)}</Text>
        </View>
        <TouchableOpacity
          onPress={finishWorkout}
          style={[styles.headerBtn, styles.finishBtn]}
          disabled={saving}
        >
          <Text style={styles.finishText}>{saving ? '…' : 'Terminer'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Workout name */}
          <TextInput
            style={styles.nameInput}
            placeholder="Nom de la séance (optionnel)"
            placeholderTextColor={theme.colors.textMuted}
            value={state.name}
            onChangeText={(v) => dispatch({ type: 'SET_NAME', value: v })}
          />

          {/* Exercises */}
          {state.exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Ionicons name="barbell-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>Ajoute ton premier exercice</Text>
            </View>
          ) : (
            state.exercises.map((ae, ei) => (
              <ExerciseBlock
                key={`${ae.exercise.id}-${ei}`}
                ae={ae}
                ei={ei}
                onAddSet={() => { dispatch({ type: 'ADD_SET', ei }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                onRemoveSet={(si) => dispatch({ type: 'REMOVE_SET', ei, si })}
                onUpdateSet={(si, field, value) => dispatch({ type: 'UPDATE_SET', ei, si, field, value })}
                onToggleComplete={(si) => { dispatch({ type: 'TOGGLE_COMPLETE', ei, si }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                onRemoveExercise={() => dispatch({ type: 'REMOVE_EXERCISE', index: ei })}
              />
            ))
          )}

          {/* Add exercise button */}
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => dispatch({ type: 'TOGGLE_PICKER' })}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addExText}>Ajouter un exercice</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Picker Modal */}
      <Modal visible={state.showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choisir un exercice</Text>
            <TouchableOpacity onPress={() => dispatch({ type: 'TOGGLE_PICKER' })}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <View style={[styles.dot, { backgroundColor: muscleColors[section.title] ?? '#888' }]} />
                <Text style={styles.sectionHeaderText}>{muscleGroupLabel(section.title)}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.exerciseRow, addedIds.has(item.id) && styles.exerciseRowAdded]}
                onPress={() => addExercise(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseName}>{item.name}</Text>
                {addedIds.has(item.id) && (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            stickySectionHeadersEnabled
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── ExerciseBlock ────────────────────────────────────────────────────────────

function ExerciseBlock({
  ae, ei, onAddSet, onRemoveSet, onUpdateSet, onToggleComplete, onRemoveExercise,
}: {
  ae: ActiveExercise;
  ei: number;
  onAddSet: () => void;
  onRemoveSet: (si: number) => void;
  onUpdateSet: (si: number, field: 'reps' | 'weight', value: string) => void;
  onToggleComplete: (si: number) => void;
  onRemoveExercise: () => void;
}) {
  const prevWorking = ae.previousSets.filter((s) => !s.isWarmup && s.completed);

  return (
    <View style={styles.exBlock}>
      <View style={styles.exHeader}>
        <View style={[styles.muscleTag, { backgroundColor: muscleColors[ae.exercise.muscleGroup] + '30' }]}>
          <View style={[styles.dot, { backgroundColor: muscleColors[ae.exercise.muscleGroup] ?? '#888' }]} />
          <Text style={[styles.muscleTagText, { color: muscleColors[ae.exercise.muscleGroup] ?? '#888' }]}>
            {muscleGroupLabel(ae.exercise.muscleGroup)}
          </Text>
        </View>
        <TouchableOpacity onPress={onRemoveExercise} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.exName}>{ae.exercise.name}</Text>

      {/* Sets table header */}
      <View style={styles.setHeader}>
        <Text style={[styles.setCell, { width: 28 }]}>#</Text>
        <Text style={[styles.setCell, { flex: 1 }]}>Précédent</Text>
        <Text style={[styles.setCell, { width: 72, textAlign: 'center' }]}>kg</Text>
        <Text style={[styles.setCell, { width: 60, textAlign: 'center' }]}>Reps</Text>
        <Text style={[styles.setCell, { width: 36 }]}> </Text>
      </View>

      {ae.sets.map((s, si) => {
        const prev = prevWorking[si];
        const oneRM = s.weight && s.reps ? estimateOneRM(Number(s.weight), Number(s.reps)) : null;
        return (
          <View key={si} style={[styles.setRow, s.completed && styles.setRowDone]}>
            <Text style={[styles.setNum, s.completed && { color: theme.colors.primary }]}>{si + 1}</Text>
            <Text style={styles.setPrev}>
              {prev ? `${prev.weight}×${prev.reps}` : '—'}
            </Text>
            <TextInput
              style={[styles.setInput, { width: 72 }]}
              value={s.weight}
              onChangeText={(v) => onUpdateSet(si, 'weight', v)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              selectTextOnFocus
            />
            <TextInput
              style={[styles.setInput, { width: 60 }]}
              value={s.reps}
              onChangeText={(v) => onUpdateSet(si, 'reps', v)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => onToggleComplete(si)}
              style={[styles.checkBtn, s.completed && styles.checkBtnDone]}
            >
              <Ionicons
                name={s.completed ? 'checkmark' : 'ellipse-outline'}
                size={18}
                color={s.completed ? '#fff' : theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Ionicons name="add" size={16} color={theme.colors.primary} />
        <Text style={styles.addSetText}>Ajouter une série</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 70,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  nameInput: {
    margin: theme.spacing.md,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  exBlock: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  muscleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  muscleTagText: { fontSize: 11, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  exName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  setCell: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
    borderRadius: theme.radius.sm,
    padding: 4,
  },
  setRowDone: {
    backgroundColor: theme.colors.primary + '15',
  },
  setNum: {
    width: 28,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  setPrev: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  setInput: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.sm,
    padding: 8,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: theme.colors.primary,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addSetText: { color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  addExText: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: theme.spacing.md,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  exerciseRowAdded: {
    backgroundColor: theme.colors.primary + '10',
  },
  exerciseName: { fontSize: 15, color: theme.colors.text },
});
