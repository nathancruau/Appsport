import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView,
  Platform, SectionList, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme, muscleColors } from '../theme';
import { Exercise, ActiveExercise, ActiveSet, WorkoutSet, BestSet } from '../types';
import {
  getAllExercises, getLastWorkoutSets, saveWorkout,
  getExerciseBest, saveTemplate,
  getRestTimerSettings, saveRestTimerSettings, RestTimerSettings,
} from '../database/database';
import { formatDuration, todayISO, muscleGroupLabel, estimateOneRM } from '../utils/calculations';

const SUPERSET_COLOR = '#3B9EFF';
const DELETE_W = 68;

// ─── State ───────────────────────────────────────────────────────────────────

type State = {
  name: string;
  exercises: ActiveExercise[];
  elapsedSeconds: number;
  showPicker: boolean;
};

type Action =
  | { type: 'SET_NAME'; value: string }
  | { type: 'ADD_EXERCISE'; exercise: Exercise; previousSets: WorkoutSet[]; bestSet?: BestSet }
  | { type: 'REMOVE_EXERCISE'; index: number }
  | { type: 'ADD_SET'; ei: number }
  | { type: 'DUPLICATE_SET'; ei: number }
  | { type: 'REMOVE_SET'; ei: number; si: number }
  | { type: 'UPDATE_SET'; ei: number; si: number; field: 'reps' | 'weight'; value: string }
  | { type: 'UPDATE_RPE'; ei: number; si: number; value: string }
  | { type: 'TOGGLE_COMPLETE'; ei: number; si: number }
  | { type: 'MOVE_EXERCISE'; index: number; direction: 'up' | 'down' }
  | { type: 'TOGGLE_SUPERSET'; index: number }
  | { type: 'TICK' }
  | { type: 'TOGGLE_PICKER' };

interface SummaryData {
  duration: number;
  totalVolume: number;
  totalSets: number;
  prs: string[];
  exerciseCount: number;
}

function makeEmptySet(prev?: WorkoutSet): ActiveSet {
  return {
    reps: prev?.reps != null ? String(prev.reps) : '',
    weight: prev?.weight != null ? String(prev.weight) : '',
    isWarmup: false,
    completed: false,
    rpe: '',
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_NAME': return { ...state, name: action.value };
    case 'ADD_EXERCISE': {
      const prevSets = action.previousSets.filter((s) => !s.isWarmup && s.completed);
      const sets = prevSets.length > 0 ? prevSets.map((s) => makeEmptySet(s)) : [makeEmptySet()];
      return {
        ...state,
        exercises: [...state.exercises, { exercise: action.exercise, sets, previousSets: action.previousSets, bestSet: action.bestSet }],
        showPicker: false,
      };
    }
    case 'REMOVE_EXERCISE':
      return { ...state, exercises: state.exercises.filter((_, i) => i !== action.index) };
    case 'ADD_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const last = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, makeEmptySet({ reps: last ? Number(last.reps) || null : null, weight: last ? Number(last.weight) || null : null } as any)];
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'DUPLICATE_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const last = ex.sets[ex.sets.length - 1];
      if (!last) return state;
      ex.sets = [...ex.sets, { ...last, completed: false, rpe: '' }];
      exs[action.ei] = ex;
      return { ...state, exercises: exs };
    }
    case 'REMOVE_SET': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      if (ex.sets.length <= 1) return state;
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
    case 'UPDATE_RPE': {
      const exs = [...state.exercises];
      const ex = { ...exs[action.ei] };
      const sets = [...ex.sets];
      sets[action.si] = { ...sets[action.si], rpe: action.value };
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
    case 'MOVE_EXERCISE': {
      const exs = [...state.exercises];
      const i = action.index;
      if (action.direction === 'up' && i > 0) {
        [exs[i - 1], exs[i]] = [exs[i], exs[i - 1]];
        if (exs[i].isSuperset) exs[i] = { ...exs[i], isSuperset: false };
      } else if (action.direction === 'down' && i < exs.length - 1) {
        [exs[i], exs[i + 1]] = [exs[i + 1], exs[i]];
        if (exs[i].isSuperset) exs[i] = { ...exs[i], isSuperset: false };
      }
      return { ...state, exercises: exs };
    }
    case 'TOGGLE_SUPERSET': {
      const exs = [...state.exercises];
      exs[action.index] = { ...exs[action.index], isSuperset: !exs[action.index].isSuperset };
      return { ...state, exercises: exs };
    }
    case 'TICK': return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case 'TOGGLE_PICKER': return { ...state, showPicker: !state.showPicker };
    default: return state;
  }
}

// ─── Swipeable row ─────────────────────────────────────────────────────────

// Native-only: PanResponder must NOT run on web — it intercepts all mouse events globally
function SwipeableRowNative({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const tx = useRef(new Animated.Value(0)).current;
  const opened = useRef(false);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      const base = opened.current ? -DELETE_W : 0;
      tx.setValue(Math.max(-DELETE_W, Math.min(0, base + gs.dx)));
    },
    onPanResponderRelease: (_, gs) => {
      const base = opened.current ? -DELETE_W : 0;
      const final = base + gs.dx;
      const shouldOpen = final < -DELETE_W / 2;
      opened.current = shouldOpen;
      Animated.spring(tx, { toValue: shouldOpen ? -DELETE_W : 0, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => {
        opened.current = false;
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
        onDelete();
      }}>
        <Ionicons name="trash" size={16} color="#fff" />
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function SwipeableRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <View style={styles.swipeContainer}>{children}</View>;
  }
  return <SwipeableRowNative onDelete={onDelete}>{children}</SwipeableRowNative>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(reducer, { name: '', exercises: [], elapsedSeconds: 0, showPicker: false });
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Rest timer
  const [restSettings, setRestSettings] = useState<RestTimerSettings>({ enabled: true, durationSeconds: 90 });
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [isRestExpanded, setIsRestExpanded] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restExpandRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restTotal = useRef(90);

  // Custom alert modal (Alert.alert is silently blocked in PWA standalone mode)
  const [alertModal, setAlertModal] = useState<{
    title: string; message: string;
    buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
  } | null>(null);

  const showAlert = (
    title: string,
    message: string,
    buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'OK' }]
  ) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, buttons.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress })));
    } else {
      setAlertModal({ title, message, buttons });
    }
  };

  // PR tracking + banner
  const [prBanner, setPrBanner] = useState<string | null>(null);
  const prAnim = useRef(new Animated.Value(0)).current;
  const prsAchievedRef = useRef<string[]>([]);

  // Save template modal
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Workout summary
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const init = async () => {
      const [exercises, settings] = await Promise.all([getAllExercises(), getRestTimerSettings()]);
      setAllExercises(exercises);
      setRestSettings(settings);
      timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
      const templateIds: number[] | undefined = route?.params?.templateExerciseIds;
      if (templateIds?.length) {
        for (const id of templateIds) {
          const ex = exercises.find((e) => e.id === id);
          if (!ex) continue;
          const [prev, best] = await Promise.all([getLastWorkoutSets(id), getExerciseBest(id)]);
          dispatch({ type: 'ADD_EXERCISE', exercise: ex, previousSets: prev, bestSet: best });
        }
      }
    };
    init();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restRef.current) clearInterval(restRef.current);
      if (restExpandRef.current) clearTimeout(restExpandRef.current);
    };
  }, []);

  const startRestTimer = useCallback((seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    if (restExpandRef.current) clearTimeout(restExpandRef.current);
    restTotal.current = seconds;
    setRestRemaining(seconds);
    setIsRestExpanded(true);
    restExpandRef.current = setTimeout(() => setIsRestExpanded(false), 5000);
    let remaining = seconds;
    restRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(restRef.current!);
        restRef.current = null;
        setRestRemaining(null);
        setIsRestExpanded(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        if (remaining % 10 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRestRemaining(remaining);
      }
    }, 1000);
  }, []);

  const skipRestTimer = () => {
    if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    if (restExpandRef.current) { clearTimeout(restExpandRef.current); restExpandRef.current = null; }
    setRestRemaining(null);
    setIsRestExpanded(false);
  };

  const showPRBanner = (exerciseName: string) => {
    prsAchievedRef.current = [...prsAchievedRef.current, exerciseName];
    setPrBanner(exerciseName);
    prAnim.setValue(0);
    Animated.sequence([
      Animated.timing(prAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.delay(2400),
      Animated.timing(prAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => setPrBanner(null));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleComplete = (ei: number, si: number) => {
    const ae = state.exercises[ei];
    const set = ae.sets[si];
    const completing = !set.completed;
    dispatch({ type: 'TOGGLE_COMPLETE', ei, si });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (completing) {
      const w = Number(set.weight), r = Number(set.reps);
      if (w > 0 && r > 0) {
        const newORM = estimateOneRM(w, r);
        if (!ae.bestSet || newORM > ae.bestSet.oneRM) showPRBanner(ae.exercise.name);
      }
      const nextIsSuperset = state.exercises[ei + 1]?.isSuperset;
      if (restSettings.enabled && !nextIsSuperset) startRestTimer(restSettings.durationSeconds);
    }
  };

  const addExercise = useCallback(async (exercise: Exercise) => {
    const [prev, best] = await Promise.all([getLastWorkoutSets(exercise.id), getExerciseBest(exercise.id)]);
    dispatch({ type: 'ADD_EXERCISE', exercise, previousSets: prev, bestSet: best });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishWorkout = () => {
    if (state.exercises.length === 0) { showAlert('Séance vide', 'Ajoute au moins un exercice avant de terminer.'); return; }
    const completedSets = state.exercises.flatMap((e) => e.sets).filter((s) => s.completed && !s.isWarmup);
    if (completedSets.length === 0) { showAlert('Aucune série complétée', 'Coche au moins une série avant de terminer.'); return; }

    showAlert('Terminer la séance ?', `${state.exercises.length} exercice(s) · ${formatDuration(state.elapsedSeconds)}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer', style: 'default',
        onPress: async () => {
          setSaving(true);
          try {
            await saveWorkout({
              name: state.name.trim() || null,
              date: todayISO(),
              duration: Math.round(state.elapsedSeconds / 60),
              exercises: state.exercises.map((ae) => ({
                exerciseId: ae.exercise.id,
                sets: ae.sets.map((s) => ({
                  reps: s.reps ? Number(s.reps) : null,
                  weight: s.weight ? Number(s.weight) : null,
                  isWarmup: s.isWarmup,
                  completed: s.completed,
                  rpe: s.rpe ? Number(s.rpe) : null,
                })),
              })),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const totalVolume = completedSets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
            setSummaryData({
              duration: state.elapsedSeconds,
              totalVolume: Math.round(totalVolume),
              totalSets: completedSets.length,
              prs: [...new Set(prsAchievedRef.current)],
              exerciseCount: state.exercises.length,
            });
          } catch { showAlert('Erreur', 'Impossible de sauvegarder la séance.'); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  const confirmDiscard = () => {
    if (state.exercises.length === 0) { navigation.goBack(); return; }
    showAlert('Abandonner la séance ?', 'Tes données non sauvegardées seront perdues.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    await saveTemplate(name, state.exercises.map((ae) => ae.exercise.id));
    setShowSaveTemplate(false);
    setTemplateName('');
    Alert.alert('Template sauvegardé', `"${name}" accessible depuis l'accueil.`);
  };

  const updateRestSettings = async (s: RestTimerSettings) => {
    setRestSettings(s);
    await saveRestTimerSettings(s);
  };

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

  const restProgress = restRemaining != null ? restRemaining / restTotal.current : 0;

  // On web, KAV causes layout issues — use plain View
  const ContentWrapper = Platform.OS !== 'web' ? KeyboardAvoidingView : View;

  return (
    <View style={styles.container}>
      {/* PR Banner */}
      {prBanner && (
        <Animated.View style={[styles.prBanner, { paddingTop: insets.top + 8, opacity: prAnim }]}>
          <Text style={styles.prBannerText}>🏆 Nouveau record — {prBanner} !</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={confirmDiscard} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.timerBox}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.timer}>{formatDuration(state.elapsedSeconds)}</Text>
          <TouchableOpacity onPress={() => setShowTimerSettings(true)} style={styles.restChip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="timer-outline" size={12} color={restSettings.enabled ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={styles.restChipText}>{restSettings.enabled ? `${restSettings.durationSeconds}s` : 'off'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={finishWorkout} style={[styles.headerBtn, styles.finishBtn]} disabled={saving} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.finishText}>{saving ? '…' : 'Terminer'}</Text>
        </TouchableOpacity>
      </View>

      <ContentWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.nameInput}
            placeholder="Nom de la séance (optionnel)"
            placeholderTextColor={theme.colors.textMuted}
            value={state.name}
            onChangeText={(v) => dispatch({ type: 'SET_NAME', value: v })}
          />

          {state.exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Ionicons name="barbell-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>Ajoute ton premier exercice</Text>
            </View>
          ) : (
            state.exercises.map((ae, ei) => {
              const isTopOfSuperset = state.exercises[ei + 1]?.isSuperset === true;
              const partnerName = ae.isSuperset && ei > 0 ? state.exercises[ei - 1].exercise.name : undefined;
              return (
                <React.Fragment key={`${ae.exercise.id}-${ei}`}>
                  {ae.isSuperset && ei > 0 && (
                    <View style={styles.supersetConnector}>
                      <View style={styles.supersetLine} />
                      <View style={styles.supersetBadge}>
                        <Text style={styles.supersetBadgeText}>SUPERSET</Text>
                      </View>
                      <View style={styles.supersetLine} />
                    </View>
                  )}
                  <ExerciseBlock
                    ae={ae} ei={ei}
                    isFirst={ei === 0}
                    isLast={ei === state.exercises.length - 1}
                    isTopOfSuperset={isTopOfSuperset}
                    supersetPartnerName={partnerName}
                    onAddSet={() => { dispatch({ type: 'ADD_SET', ei }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    onDuplicateSet={() => { dispatch({ type: 'DUPLICATE_SET', ei }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                    onRemoveSet={(si) => dispatch({ type: 'REMOVE_SET', ei, si })}
                    onUpdateSet={(si, field, value) => dispatch({ type: 'UPDATE_SET', ei, si, field, value })}
                    onUpdateRPE={(si, value) => dispatch({ type: 'UPDATE_RPE', ei, si, value })}
                    onToggleComplete={(si) => handleToggleComplete(ei, si)}
                    onRemoveExercise={() => dispatch({ type: 'REMOVE_EXERCISE', index: ei })}
                    onMoveUp={() => dispatch({ type: 'MOVE_EXERCISE', index: ei, direction: 'up' })}
                    onMoveDown={() => dispatch({ type: 'MOVE_EXERCISE', index: ei, direction: 'down' })}
                    onToggleSuperset={() => dispatch({ type: 'TOGGLE_SUPERSET', index: ei })}
                  />
                </React.Fragment>
              );
            })
          )}

          <TouchableOpacity style={styles.addExBtn} onPress={() => dispatch({ type: 'TOGGLE_PICKER' })}>
            <Ionicons name="add" size={20} color={theme.colors.text} />
            <Text style={styles.addExText}>Ajouter un exercice</Text>
          </TouchableOpacity>

          {state.exercises.length > 0 && (
            <TouchableOpacity style={styles.saveTemplateBtn} onPress={() => { setTemplateName(state.name || ''); setShowSaveTemplate(true); }}>
              <Ionicons name="bookmark-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.saveTemplateText}>Sauvegarder comme template</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ContentWrapper>

      {/* Rest Timer — grand (5 premières secondes) */}
      {restRemaining !== null && isRestExpanded && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsRestExpanded(false)}
          style={[styles.restExpandedOverlay, { paddingTop: insets.top + 80, paddingBottom: Math.max(insets.bottom, 32) }]}
        >
          <Text style={styles.restExpandedLabel}>Repos</Text>
          <Text style={styles.restExpandedTime}>
            {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
          </Text>
          <View style={styles.restProgressBarLg}>
            <View style={[styles.restProgressFill, { width: `${(1 - restProgress) * 100}%` }]} />
          </View>
          <View style={styles.restSkip}>
            <Text style={styles.restSkipText}>Passer →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Rest Timer — petit (après 5 s) */}
      {restRemaining !== null && !isRestExpanded && (
        <View style={[styles.restOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.restCard}>
            <Text style={styles.restLabel}>Repos</Text>
            <Text style={styles.restTime}>
              {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
            </Text>
            <View style={styles.restProgressBar}>
              <View style={[styles.restProgressFill, { width: `${(1 - restProgress) * 100}%` }]} />
            </View>
            <TouchableOpacity onPress={skipRestTimer} style={styles.restSkip}>
              <Text style={styles.restSkipText}>Passer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Exercise Picker */}
      {state.showPicker && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modal, { paddingTop: Math.max(insets.top, 16) }]}>
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
                  {addedIds.has(item.id) && <Ionicons name="checkmark" size={16} color={theme.colors.text} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              stickySectionHeadersEnabled
            />
          </View>
        </Modal>
      )}

      {/* Rest Timer Settings */}
      {showTimerSettings && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modal, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chrono de repos</Text>
              <TouchableOpacity onPress={() => setShowTimerSettings(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: theme.spacing.md }}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Activer le chrono</Text>
                <TouchableOpacity
                  onPress={() => updateRestSettings({ ...restSettings, enabled: !restSettings.enabled })}
                  style={[styles.toggle, restSettings.enabled && styles.toggleOn]}
                >
                  <View style={[styles.toggleThumb, restSettings.enabled && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {restSettings.enabled && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Text style={styles.settingSubLabel}>Durée du repos</Text>
                  <View style={styles.durationRow}>
                    {[60, 90, 120].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.durationChip, restSettings.durationSeconds === d && styles.durationChipActive]}
                        onPress={() => updateRestSettings({ ...restSettings, durationSeconds: d })}
                      >
                        <Text style={[styles.durationChipText, restSettings.durationSeconds === d && styles.durationChipTextActive]}>
                          {d === 60 ? '1 min' : d === 90 ? '1 min 30' : '2 min'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modal, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSaveTemplate(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nouveau template</Text>
              <TouchableOpacity onPress={handleSaveTemplate}>
                <Text style={[styles.cancelText, { color: theme.colors.text, fontWeight: '700' }]}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: theme.spacing.md }}>
              <Text style={styles.settingSubLabel}>Nom du template</Text>
              <TextInput
                style={styles.templateInput}
                placeholder="Ex : Push A, Jambes, Full body…"
                placeholderTextColor={theme.colors.textMuted}
                value={templateName}
                onChangeText={setTemplateName}
                autoFocus
              />
              <Text style={styles.templateExList}>
                {state.exercises.map((ae) => ae.exercise.name).join(' · ')}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Alert Modal (replaces Alert.alert on web/PWA) */}
      {alertModal && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{alertModal.title}</Text>
              {!!alertModal.message && <Text style={styles.alertMessage}>{alertModal.message}</Text>}
              <View style={[styles.alertButtons, alertModal.buttons.length > 1 && { flexDirection: 'row' }]}>
                {alertModal.buttons.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.alertBtn,
                      alertModal.buttons.length > 1 && { flex: 1 },
                      btn.style === 'destructive' && styles.alertBtnDestructive,
                      btn.style === 'cancel' && styles.alertBtnCancel,
                    ]}
                    onPress={() => { setAlertModal(null); btn.onPress?.(); }}
                  >
                    <Text style={[styles.alertBtnText, btn.style === 'destructive' && styles.alertBtnDestructiveText]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Workout Summary Modal */}
      {summaryData && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.summaryModal, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.summaryEmoji}>🎉</Text>
            <Text style={styles.summaryTitle}>Séance terminée !</Text>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatVal}>{formatDuration(summaryData.duration)}</Text>
                <Text style={styles.summaryStatLabel}>Durée</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatVal}>{summaryData.totalVolume.toLocaleString('fr')} kg</Text>
                <Text style={styles.summaryStatLabel}>Volume</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatVal}>{summaryData.totalSets}</Text>
                <Text style={styles.summaryStatLabel}>Séries</Text>
              </View>
            </View>

            {summaryData.prs.length > 0 && (
              <View style={styles.summaryPRs}>
                <Text style={styles.summaryPRTitle}>🏆 Records battus</Text>
                {summaryData.prs.map((name, i) => (
                  <Text key={i} style={styles.summaryPRName}>{name}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.summaryCloseBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.summaryCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── ExerciseBlock ────────────────────────────────────────────────────────────

function ExerciseBlock({
  ae, ei, isFirst, isLast, isTopOfSuperset, supersetPartnerName,
  onAddSet, onDuplicateSet, onRemoveSet, onUpdateSet, onUpdateRPE, onToggleComplete,
  onRemoveExercise, onMoveUp, onMoveDown, onToggleSuperset,
}: {
  ae: ActiveExercise; ei: number;
  isFirst: boolean; isLast: boolean;
  isTopOfSuperset: boolean;
  supersetPartnerName?: string;
  onAddSet: () => void;
  onDuplicateSet: () => void;
  onRemoveSet: (si: number) => void;
  onUpdateSet: (si: number, field: 'reps' | 'weight', value: string) => void;
  onUpdateRPE: (si: number, value: string) => void;
  onToggleComplete: (si: number) => void;
  onRemoveExercise: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSuperset: () => void;
}) {
  const prevWorking = ae.previousSets.filter((s) => !s.isWarmup && s.completed);
  const muscleColor = muscleColors[ae.exercise.muscleGroup] ?? '#888';
  const inSuperset = ae.isSuperset || isTopOfSuperset;

  // Double-tap detection for "add set"
  const lastTapRef = useRef(0);
  const handleAddTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      onDuplicateSet();
    } else {
      onAddSet();
    }
    lastTapRef.current = now;
  };

  return (
    <View style={[styles.exBlock, inSuperset && styles.exBlockSuperset]}>
      <View style={styles.exHeader}>
        <View style={[styles.muscleTag, { backgroundColor: muscleColor + '22' }]}>
          <View style={[styles.dot, { backgroundColor: muscleColor }]} />
          <Text style={[styles.muscleTagText, { color: muscleColor }]}>
            {muscleGroupLabel(ae.exercise.muscleGroup)}
          </Text>
        </View>
        <View style={styles.exHeaderActions}>
          {!isFirst && (
            <TouchableOpacity
              onPress={onToggleSuperset}
              style={[styles.ssBtn, ae.isSuperset && styles.ssBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.ssBtnText, ae.isSuperset && styles.ssBtnTextActive]}>SS</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onMoveUp} disabled={isFirst} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-up" size={16} color={isFirst ? theme.colors.textMuted + '40' : theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} disabled={isLast} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-down" size={16} color={isLast ? theme.colors.textMuted + '40' : theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemoveExercise} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.exName}>{ae.exercise.name}</Text>

      {supersetPartnerName && (
        <View style={styles.supersetPartnerRow}>
          <Ionicons name="swap-vertical" size={12} color={SUPERSET_COLOR} />
          <Text style={styles.supersetPartnerText}>Superset avec {supersetPartnerName}</Text>
        </View>
      )}
      {isTopOfSuperset && !ae.isSuperset && (
        <View style={styles.supersetPartnerRow}>
          <Ionicons name="swap-vertical" size={12} color={SUPERSET_COLOR} />
          <Text style={styles.supersetPartnerText}>Enchaîner sans repos</Text>
        </View>
      )}

      {ae.bestSet && (
        <Text style={styles.bestLabel}>
          Record : {ae.bestSet.weight} kg × {ae.bestSet.reps} reps · 1RM ≈ {ae.bestSet.oneRM} kg
        </Text>
      )}

      <View style={styles.setHeader}>
        <Text style={[styles.setCell, { width: 28 }]}>#</Text>
        <Text style={[styles.setCell, { flex: 1 }]}>Précédent</Text>
        <Text style={[styles.setCell, { width: 72, textAlign: 'center' }]}>kg</Text>
        <Text style={[styles.setCell, { width: 60, textAlign: 'center' }]}>Reps</Text>
        <Text style={[styles.setCell, { width: 36 }]}> </Text>
      </View>

      {ae.sets.map((s, si) => {
        const prev = prevWorking[si];
        return (
          <React.Fragment key={si}>
            <SwipeableRow onDelete={() => onRemoveSet(si)}>
              <View style={[styles.setRow, s.completed && styles.setRowDone]}>
                <Text style={[styles.setNum, s.completed && styles.setNumDone]}>{si + 1}</Text>
                <Text style={styles.setPrev}>{prev ? `${prev.weight}×${prev.reps}` : '—'}</Text>
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
                <TouchableOpacity onPress={() => onToggleComplete(si)} style={[styles.checkBtn, s.completed && styles.checkBtnDone]}>
                  <Ionicons name={s.completed ? 'checkmark' : 'ellipse-outline'} size={18} color={s.completed ? '#fff' : theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </SwipeableRow>
            {s.completed && (
              <View style={styles.rpeBlock}>
                <Text style={styles.rpeLabel}>RPE</Text>
                <View style={styles.rpeRow}>
                  {['1','2','3','4','5'].map((val) => (
                    <TouchableOpacity key={val} style={[styles.rpeChip, s.rpe === val && styles.rpeChipActive]} onPress={() => onUpdateRPE(si, s.rpe === val ? '' : val)}>
                      <Text style={[styles.rpeChipText, s.rpe === val && styles.rpeChipTextActive]}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.rpeRow}>
                  {['6','7','8','9','10'].map((val) => (
                    <TouchableOpacity key={val} style={[styles.rpeChip, s.rpe === val && styles.rpeChipActive]} onPress={() => onUpdateRPE(si, s.rpe === val ? '' : val)}>
                      <Text style={[styles.rpeChipText, s.rpe === val && styles.rpeChipTextActive]}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </React.Fragment>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={handleAddTap}>
        <Ionicons name="add" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.addSetText}>Ajouter une série</Text>
        <Text style={styles.addSetHint}>  double-tap = dupliquer</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  prBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: '#1A1A1A', paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  prBannerText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 70 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timer: { fontSize: 16, fontWeight: '600', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6, backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  restChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  finishBtn: { backgroundColor: theme.colors.text, borderRadius: theme.radius.sm, alignItems: 'center' },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  nameInput: {
    margin: theme.spacing.md, backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: theme.colors.text,
  },

  supersetConnector: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: theme.spacing.md + 12, marginVertical: -2, zIndex: 1,
  },
  supersetLine: { flex: 1, height: 2, backgroundColor: SUPERSET_COLOR, opacity: 0.4 },
  supersetBadge: {
    backgroundColor: SUPERSET_COLOR + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 3, marginHorizontal: 8,
    borderWidth: 1, borderColor: SUPERSET_COLOR + '44',
  },
  supersetBadgeText: { fontSize: 10, fontWeight: '800', color: SUPERSET_COLOR, letterSpacing: 0.8 },

  exBlock: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, padding: theme.spacing.md,
  },
  exBlockSuperset: { borderLeftWidth: 3, borderLeftColor: SUPERSET_COLOR },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  muscleTagText: { fontSize: 11, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  exName: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 2 },
  supersetPartnerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  supersetPartnerText: { fontSize: 12, color: SUPERSET_COLOR, fontWeight: '600' },
  bestLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 10, fontStyle: 'italic' },

  ssBtn: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1.5, borderColor: theme.colors.border },
  ssBtnActive: { backgroundColor: SUPERSET_COLOR, borderColor: SUPERSET_COLOR },
  ssBtnText: { fontSize: 10, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.5 },
  ssBtnTextActive: { color: '#fff' },

  setHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 },
  setCell: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  // Swipeable
  swipeContainer: { overflow: 'hidden', borderRadius: theme.radius.sm, marginBottom: 2 },
  swipeDeleteBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_W,
    backgroundColor: theme.colors.error, justifyContent: 'center', alignItems: 'center',
    borderRadius: theme.radius.sm,
  },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, backgroundColor: theme.colors.card },
  setRowDone: { backgroundColor: 'rgba(26,26,26,0.06)' },
  setNum: { width: 28, fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  setNumDone: { color: theme.colors.text },
  setPrev: { flex: 1, minWidth: 0, fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
  setInput: {
    backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.sm,
    padding: 8, fontSize: 15, fontWeight: '600', color: theme.colors.text, textAlign: 'center',
  },
  checkBtn: { width: 36, height: 36, flexShrink: 0, borderRadius: theme.radius.sm, backgroundColor: theme.colors.inputBackground, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { backgroundColor: theme.colors.text },

  // RPE - 2 rows
  rpeBlock: { paddingHorizontal: 4, paddingBottom: 6, paddingTop: 2, gap: 4 },
  rpeLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rpeRow: { flexDirection: 'row', gap: 4 },
  rpeChip: {
    flex: 1, paddingVertical: 5, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
  },
  rpeChipActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  rpeChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  rpeChipTextActive: { color: '#fff' },

  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  addSetText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  addSetHint: { color: theme.colors.textMuted, fontSize: 11 },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: theme.spacing.md, marginTop: theme.spacing.sm, paddingVertical: 14,
    borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border,
  },
  addExText: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },

  saveTemplateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  saveTemplateText: { color: theme.colors.textSecondary, fontSize: 13 },

  // Rest timer — grand
  restExpandedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', zIndex: 5,
  },
  restExpandedLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  restExpandedTime: { color: '#fff', fontSize: 80, fontWeight: '800', fontVariant: ['tabular-nums'], marginBottom: 16 },
  restProgressBarLg: { width: 200, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginBottom: 32 },

  restOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  restCard: {
    backgroundColor: '#1A1A1A', borderRadius: 24, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  restLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  restTime: { color: '#fff', fontSize: 52, fontWeight: '800', marginVertical: 8, fontVariant: ['tabular-nums'] },
  restProgressBar: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 },
  restProgressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  restSkip: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  restSkipText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },

  emptyExercises: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: theme.colors.textMuted, fontSize: 15 },

  modal: { flex: 1, backgroundColor: theme.colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  cancelText: { fontSize: 16, color: theme.colors.textSecondary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: theme.spacing.md, backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  exerciseRowAdded: { backgroundColor: theme.colors.inputBackground },
  exerciseName: { fontSize: 15, color: theme.colors.text },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 16, color: theme.colors.text, fontWeight: '500' },
  settingSubLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: theme.colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: theme.colors.text },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center' },
  durationChipActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  durationChipText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  durationChipTextActive: { color: '#fff' },
  templateInput: { backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: theme.colors.text, marginBottom: 12 },
  templateExList: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },

  // Custom alert modal
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnCancel: { backgroundColor: theme.colors.inputBackground },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  alertBtnDestructiveText: { color: theme.colors.error },

  // Summary modal
  summaryModal: {
    flex: 1, backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  summaryEmoji: { fontSize: 56, marginBottom: 12 },
  summaryTitle: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginBottom: 32 },
  summaryStats: {
    flexDirection: 'row', backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg, padding: 20, width: '100%',
    alignItems: 'center', justifyContent: 'space-around', marginBottom: 24,
  },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryStatVal: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  summaryStatLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryDivider: { width: 1, height: 40, backgroundColor: theme.colors.border },
  summaryPRs: {
    width: '100%', backgroundColor: '#FFF9E6', borderRadius: theme.radius.md,
    padding: 16, marginBottom: 24,
  },
  summaryPRTitle: { fontSize: 14, fontWeight: '700', color: '#B8860B', marginBottom: 8 },
  summaryPRName: { fontSize: 14, color: theme.colors.text, marginBottom: 4 },
  summaryCloseBtn: {
    width: '100%', backgroundColor: theme.colors.text, borderRadius: theme.radius.lg,
    paddingVertical: 16, alignItems: 'center',
  },
  summaryCloseBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
