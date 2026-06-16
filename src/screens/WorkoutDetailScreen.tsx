import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, SectionList,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { RootStackParamList, Workout, Exercise } from '../types';
import {
  getWorkoutDetail, WorkoutExerciseDetail, deleteWorkout, saveTemplate,
  updateWorkoutSets, renameWorkout, addSetsToWorkoutExercise,
  addExerciseToWorkout, getAllExercises,
} from '../database/database';
import { formatDateFull, formatDuration, muscleGroupLabel, formatWeight } from '../utils/calculations';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;
type AlertBtn = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export default function WorkoutDetailScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExerciseDetail[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showExPicker, setShowExPicker] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; buttons: AlertBtn[] } | null>(null);
  const [editModal, setEditModal] = useState<{
    ex: WorkoutExerciseDetail;
    sets: { id: number; weight: string; reps: string; duration: string }[];
  } | null>(null);

  const load = async () => {
    const [detail, allEx] = await Promise.all([
      getWorkoutDetail(params.workoutId),
      getAllExercises(),
    ]);
    setWorkout(detail.workout);
    setExercises(detail.exercises);
    setAllExercises(allEx);
    setLoading(false);
  };

  useEffect(() => { load(); }, [params.workoutId]);

  const showAlert = (title: string, message: string, buttons: AlertBtn[] = [{ text: 'OK' }]) => {
    setAlertModal({ title, message, buttons });
  };

  const handleDelete = () => {
    showAlert('Supprimer cette séance ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteWorkout(params.workoutId);
        navigation.goBack();
      }},
    ]);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    await saveTemplate(name, exercises.map((e) => e.exerciseId));
    setShowSaveTemplate(false);
    setTemplateName('');
    showAlert('Template sauvegardé', `"${name}" est maintenant disponible sur l'accueil.`);
  };

  const openEdit = (ex: WorkoutExerciseDetail) => {
    setEditModal({
      ex,
      sets: ex.sets
        .filter((s) => !s.isWarmup && s.completed)
        .map((s) => ({
          id: s.id,
          weight: s.weight != null ? String(s.weight) : '',
          reps: s.reps != null ? String(s.reps) : '',
          duration: s.duration != null ? String(s.duration) : '',
        })),
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const existing = editModal.sets.filter((s) => s.id > 0).map((s) => ({
      id: s.id,
      weight: s.weight ? Number(s.weight) : null,
      reps: s.reps ? Number(s.reps) : null,
      duration: s.duration ? Number(s.duration) : null,
    }));
    const newSets = editModal.sets.filter((s) => s.id <= 0).map((s) => ({
      weight: s.weight ? Number(s.weight) : null,
      reps: s.reps ? Number(s.reps) : null,
      duration: s.duration ? Number(s.duration) : null,
    }));
    if (existing.length > 0) {
      await updateWorkoutSets(params.workoutId, editModal.ex.exerciseId, existing);
    }
    if (newSets.length > 0) {
      await addSetsToWorkoutExercise(params.workoutId, editModal.ex.exerciseId, newSets);
    }
    await load();
    setEditModal(null);
  };

  const addNewExercise = async (ex: Exercise) => {
    setShowExPicker(false);
    setExSearch('');
    await addExerciseToWorkout(params.workoutId, ex.id);
    await load();
    // Reload the updated exercises and open edit modal for the newly added one
    const detail = await getWorkoutDetail(params.workoutId);
    const newEx = detail.exercises.find((e) => e.exerciseId === ex.id && e.sets.length === 0);
    if (newEx) openEdit(newEx);
  };

  const filteredExercises = useMemo(() => {
    const q = exSearch.toLowerCase();
    return allExercises.filter((e) =>
      e.name.toLowerCase().includes(q) || muscleGroupLabel(e.muscleGroup).toLowerCase().includes(q)
    );
  }, [allExercises, exSearch]);

  const exSections = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const e of filteredExercises) {
      if (!groups[e.muscleGroup]) groups[e.muscleGroup] = [];
      groups[e.muscleGroup].push(e);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filteredExercises]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  if (!workout) return null;

  const totalVolume = exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.completed && !s.isWarmup && s.reps && s.weight)
    .reduce((sum, s) => sum + s.reps! * s.weight!, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.date}>{formatDateFull(workout.date)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.name, { flex: 1, marginBottom: 0 }]}>{workout.name ?? 'Séance'}</Text>
            <TouchableOpacity
              onPress={() => { setRenameName(workout.name ?? ''); setShowRename(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
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
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setTemplateName(workout.name ?? ''); setShowSaveTemplate(true); }}>
              <Ionicons name="bookmark-outline" size={15} color={theme.colors.text} />
              <Text style={styles.actionBtnText}>Enregistrer comme template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
              <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercises */}
        {exercises.map((ex) => {
          const warmupSets = ex.sets.filter((s) => s.isWarmup);
          const vol = ex.sets.filter((s) => !s.isWarmup && s.completed && s.reps && s.weight).reduce((sum, s) => sum + s.reps! * s.weight!, 0);
          return (
            <View key={ex.id} style={styles.exCard}>
              <View style={styles.exHeader}>
                <TouchableOpacity
                  style={styles.exHeaderLeft}
                  onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.exerciseId, exerciseName: ex.exerciseName })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dot, { backgroundColor: muscleColors[ex.muscleGroup] ?? '#888' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex.exerciseName}</Text>
                    <Text style={styles.exMuscle}>{muscleGroupLabel(ex.muscleGroup)}</Text>
                  </View>
                  {vol > 0 && <Text style={styles.exVol}>{Math.round(vol).toLocaleString('fr')} kg</Text>}
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(ex)} style={styles.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.setHeader}>
                <Text style={[styles.setCell, { width: 28 }]}>#</Text>
                {ex.trackingType === 'time' ? (
                  <Text style={[styles.setCell, { flex: 1 }]}>Durée</Text>
                ) : (
                  <>
                    <Text style={[styles.setCell, { flex: 1 }]}>Poids</Text>
                    <Text style={[styles.setCell, { flex: 1 }]}>Reps</Text>
                  </>
                )}
              </View>
              {ex.sets.length === 0 && (
                <Text style={styles.emptySetHint}>Appuie sur le crayon pour ajouter des séries</Text>
              )}
              {ex.sets.map((s, i) => (
                <View key={s.id} style={[styles.setRow, s.isWarmup && styles.setWarmup]}>
                  <Text style={styles.setNum}>{s.isWarmup ? 'E' : i + 1 - warmupSets.filter((_, wi) => wi < i).length}</Text>
                  {ex.trackingType === 'time' ? (
                    <Text style={[styles.setValue, { flex: 2 }]}>{s.duration != null ? `${s.duration}s` : '—'}</Text>
                  ) : (
                    <>
                      <Text style={styles.setValue}>{s.weight != null ? `${formatWeight(s.weight)} kg` : '—'}</Text>
                      <Text style={styles.setValue}>{s.reps ?? '—'}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          );
        })}

        {/* Add exercise button */}
        <TouchableOpacity style={styles.addExBtn} onPress={() => setShowExPicker(true)}>
          <Ionicons name="add" size={18} color={theme.colors.textSecondary} />
          <Text style={styles.addExText}>Ajouter un exercice</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Sets Overlay (replaces Modal for web compat) */}
      {editModal && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModal(null)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editModal.ex.exerciseName}</Text>
            <TouchableOpacity onPress={saveEdit}>
              <Text style={[styles.cancelText, { color: theme.colors.primary, fontWeight: '700' }]}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.md }}>
            <View style={styles.editSetHeader}>
              <Text style={[styles.editCell, { width: 32 }]}>#</Text>
              {editModal.ex.trackingType === 'time' ? (
                <Text style={[styles.editCell, { flex: 1 }]}>Durée (s)</Text>
              ) : (
                <>
                  <Text style={[styles.editCell, { flex: 1 }]}>Poids (kg)</Text>
                  <Text style={[styles.editCell, { flex: 1 }]}>Reps</Text>
                </>
              )}
            </View>
            {editModal.sets.map((s, i) => (
              <View key={`${s.id}-${i}`} style={styles.editSetRow}>
                <Text style={styles.editSetNum}>{i + 1}</Text>
                {editModal!.ex.trackingType === 'time' ? (
                  <TextInput
                    style={[styles.editInput, { flex: 1 }]}
                    value={s.duration}
                    onChangeText={(v) => setEditModal((prev) => prev ? {
                      ...prev, sets: prev.sets.map((x, xi) => xi === i ? { ...x, duration: v } : x),
                    } : null)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    selectTextOnFocus
                  />
                ) : (
                  <>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={s.weight}
                      onChangeText={(v) => setEditModal((prev) => prev ? {
                        ...prev, sets: prev.sets.map((x, xi) => xi === i ? { ...x, weight: v } : x),
                      } : null)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      selectTextOnFocus
                    />
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={s.reps}
                      onChangeText={(v) => setEditModal((prev) => prev ? {
                        ...prev, sets: prev.sets.map((x, xi) => xi === i ? { ...x, reps: v } : x),
                      } : null)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      selectTextOnFocus
                    />
                  </>
                )}
              </View>
            ))}
            {/* Add set button */}
            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={() => setEditModal((prev) => prev ? {
                ...prev,
                sets: [...prev.sets, { id: -Date.now(), weight: '', reps: '', duration: '' }],
              } : null)}
            >
              <Ionicons name="add" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.addSetText}>Ajouter une série</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Rename Overlay */}
      {showRename && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRename(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Renommer</Text>
            <TouchableOpacity onPress={async () => {
              await renameWorkout(params.workoutId, renameName.trim() || null);
              setShowRename(false);
              await load();
            }}>
              <Text style={[styles.cancelText, { color: theme.colors.primary, fontWeight: '700' }]}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: theme.spacing.md }}>
            <Text style={styles.label}>Nom de la séance</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : Push A, Full body…"
              placeholderTextColor={theme.colors.textMuted}
              value={renameName}
              onChangeText={setRenameName}
              autoFocus
            />
          </View>
        </View>
      )}

      {/* Save Template Overlay */}
      {showSaveTemplate && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
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
            <Text style={styles.label}>Nom du template</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : Push A, Jambes…"
              placeholderTextColor={theme.colors.textMuted}
              value={templateName}
              onChangeText={setTemplateName}
              autoFocus
            />
            <Text style={styles.exList}>{exercises.map((e) => e.exerciseName).join(' · ')}</Text>
          </View>
        </View>
      )}

      {/* Exercise Picker Overlay */}
      {showExPicker && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowExPicker(false); setExSearch(''); }}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajouter un exercice</Text>
            <View style={{ width: 70 }} />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={15} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher…"
              placeholderTextColor={theme.colors.textMuted}
              value={exSearch}
              onChangeText={setExSearch}
              autoFocus
            />
            {exSearch.length > 0 && (
              <TouchableOpacity onPress={() => setExSearch('')}>
                <Ionicons name="close-circle" size={15} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <SectionList
            sections={exSections}
            keyExtractor={(item) => String(item.id)}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <View style={[styles.dot, { backgroundColor: muscleColors[section.title] ?? '#888' }]} />
                <Text style={styles.sectionTitle}>{muscleGroupLabel(section.title)}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.exRow} onPress={() => addNewExercise(item)} activeOpacity={0.7}>
                <Text style={styles.exRowName}>{item.name}</Text>
                {item.trackingType === 'time' && (
                  <Ionicons name="timer-outline" size={14} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            stickySectionHeadersEnabled
          />
        </View>
      )}

      {/* Custom Alert */}
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
                    style={[styles.alertBtn, alertModal.buttons.length > 1 && { flex: 1 }, btn.style === 'destructive' && styles.alertBtnDestructive]}
                    onPress={() => { setAlertModal(null); btn.onPress?.(); }}
                  >
                    <Text style={[styles.alertBtnText, btn.style === 'destructive' && { color: theme.colors.error }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginBottom: theme.spacing.md,
  },
  date: { fontSize: 13, color: theme.colors.textMuted, textTransform: 'capitalize', marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase' },
  actions: { gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border,
  },
  actionBtnDanger: { backgroundColor: '#FFF0F0', borderColor: theme.colors.error + '40' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  exCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, padding: theme.spacing.md,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  exHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  editBtn: { paddingLeft: 4, paddingTop: 2 },
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
  emptySetHint: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: theme.spacing.md, marginTop: theme.spacing.sm, paddingVertical: 12,
    borderRadius: theme.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border,
  },
  addExText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  // Overlay (replaces Modal for web compat)
  overlay: { backgroundColor: theme.colors.background, zIndex: 100 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  cancelText: { fontSize: 16, color: theme.colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: theme.colors.text, marginBottom: 10 },
  exList: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },
  // Edit sets
  editSetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2, gap: 8 },
  editCell: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  editSetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  editSetNum: { width: 32, fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  editInput: {
    backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.sm,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, fontWeight: '600',
    color: theme.colors.text, textAlign: 'center',
  },
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, marginTop: 4, borderRadius: theme.radius.sm,
    borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border,
  },
  addSetText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  // Exercise picker
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.md, marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  exRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  exRowName: { fontSize: 15, color: theme.colors.text },
  // Alert
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
});
