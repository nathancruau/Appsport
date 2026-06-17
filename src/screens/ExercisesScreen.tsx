import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SectionList, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { Exercise, RootStackParamList } from '../types';
import { getAllExercises, createExercise, deleteExercise, updateExercise } from '../database/database';
import { muscleGroupLabel } from '../utils/calculations';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'];

type AlertBtn = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('chest');
  const [newTracking, setNewTracking] = useState<'weight' | 'time'>('weight');
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);
  const [editName, setEditName] = useState('');
  const [editMuscle, setEditMuscle] = useState('chest');
  const [editTracking, setEditTracking] = useState<'weight' | 'time'>('weight');
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; buttons: AlertBtn[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllExercises().then((data) => { if (active) setExercises(data); });
      return () => { active = false; };
    }, [])
  );

  const showAlert = (title: string, message: string, buttons: AlertBtn[] = [{ text: 'OK' }]) => {
    setAlertModal({ title, message, buttons });
  };

  const filtered = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      muscleGroupLabel(e.muscleGroup).toLowerCase().includes(search.toLowerCase())
  );

  const sections = MUSCLE_GROUPS.map((g) => ({
    title: g,
    data: filtered.filter((e) => e.muscleGroup === g),
  })).filter((s) => s.data.length > 0);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { showAlert('Nom requis', "Saisis un nom pour l'exercice."); return; }
    if (exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      showAlert('Exercice déjà existant', `"${name}" est déjà dans la liste.`);
      return;
    }
    await createExercise(name, newMuscle, 'strength', newTracking);
    const updated = await getAllExercises();
    setExercises(updated);
    setShowAdd(false);
    setNewName('');
    setNewMuscle('chest');
    setNewTracking('weight');
  };

  const openEdit = (ex: Exercise) => {
    setEditTarget(ex);
    setEditName(ex.name);
    setEditMuscle(ex.muscleGroup);
    setEditTracking(ex.trackingType ?? 'weight');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) { showAlert('Nom requis', "Saisis un nom pour l'exercice."); return; }
    if (exercises.some((e) => e.id !== editTarget.id && e.name.toLowerCase() === name.toLowerCase())) {
      showAlert('Nom déjà utilisé', `"${name}" est déjà dans la liste.`);
      return;
    }
    await updateExercise(editTarget.id, { name, muscleGroup: editMuscle, trackingType: editTracking });
    const updated = await getAllExercises();
    setExercises(updated);
    setEditTarget(null);
  };

  const confirmDeleteExercise = (ex: Exercise) => {
    showAlert("Supprimer l'exercice ?", `"${ex.name}" sera supprimé définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteExercise(ex.id);
        const updated = await getAllExercises();
        setExercises(updated);
      }},
    ]);
  };

  const FormOverlay = ({ title, name, setName, muscle, setMuscle, tracking, setTracking, onSave, onCancel, saveLabel }: {
    title: string; name: string; setName: (v: string) => void;
    muscle: string; setMuscle: (v: string) => void;
    tracking: 'weight' | 'time'; setTracking: (v: 'weight' | 'time') => void;
    onSave: () => void; onCancel: () => void; saveLabel: string;
  }) => (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.saveText}>{saveLabel}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Développé couché barre"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Type de suivi</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['weight', 'time'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.muscleChip, tracking === t && { backgroundColor: theme.colors.primary }]}
                onPress={() => setTracking(t)}
              >
                <Ionicons name={t === 'weight' ? 'barbell-outline' : 'timer-outline'} size={14} color={tracking === t ? '#fff' : theme.colors.text} />
                <Text style={[styles.muscleChipText, tracking === t && { color: '#fff' }]}>
                  {t === 'weight' ? 'Poids / reps' : 'Temps (s)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Groupe musculaire</Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.muscleChip, muscle === g && { backgroundColor: theme.colors.primary }]}
                onPress={() => setMuscle(g)}
              >
                <View style={[styles.dot, { backgroundColor: muscleColors[g] ?? '#888' }]} />
                <Text style={[styles.muscleChipText, muscle === g && { color: '#fff' }]}>
                  {muscleGroupLabel(g)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Exercices</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={20} color="#fff" />
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
            <Text style={styles.sectionTitle}>{muscleGroupLabel(section.title)}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: item.id, exerciseName: item.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.rowName}>{item.name}</Text>
              {item.trackingType === 'time' && (
                <Ionicons name="timer-outline" size={14} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
            {!item.isDefault && (
              <>
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={styles.iconBtn}
                >
                  <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDeleteExercise(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />

      {showAdd && (
        <FormOverlay
          title="Nouvel exercice" saveLabel="Ajouter"
          name={newName} setName={setNewName}
          muscle={newMuscle} setMuscle={setNewMuscle}
          tracking={newTracking} setTracking={setNewTracking}
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); setNewName(''); }}
        />
      )}

      {editTarget && (
        <FormOverlay
          title="Modifier l'exercice" saveLabel="Enregistrer"
          name={editName} setName={setEditName}
          muscle={editMuscle} setMuscle={setEditMuscle}
          tracking={editTracking} setTracking={setEditTracking}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

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
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  pageTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text },
  addBtn: {
    backgroundColor: theme.colors.primary, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, color: theme.colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 14, gap: 6 },
  rowName: { flex: 1, fontSize: 15, color: theme.colors.text },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 14 },
  overlay: { backgroundColor: theme.colors.background, zIndex: 100 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  cancelText: { fontSize: 16, color: theme.colors.textSecondary },
  saveText: { fontSize: 16, color: theme.colors.primary, fontWeight: '600' },
  formGroup: { padding: theme.spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: theme.colors.text },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.card, borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  muscleChipText: { fontSize: 13, color: theme.colors.text },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
});
