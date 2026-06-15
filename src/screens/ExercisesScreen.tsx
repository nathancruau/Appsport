import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SectionList, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { Exercise, RootStackParamList } from '../types';
import { getAllExercises, createExercise } from '../database/database';
import { muscleGroupLabel } from '../utils/calculations';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'];

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('chest');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllExercises().then((data) => { if (active) setExercises(data); });
      return () => { active = false; };
    }, [])
  );

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
    if (!name) { Alert.alert('Nom requis'); return; }
    if (exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Exercice déjà existant');
      return;
    }
    await createExercise(name, newMuscle, 'strength');
    const updated = await getAllExercises();
    setExercises(updated);
    setShowAdd(false);
    setNewName('');
    setNewMuscle('chest');
  };

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
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: item.id, exerciseName: item.name })}
            activeOpacity={0.7}
          >
            <Text style={styles.rowName}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />

      {/* Add exercise modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAdd(false); setNewName(''); }}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvel exercice</Text>
            <TouchableOpacity onPress={handleAdd}>
              <Text style={styles.saveText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex : Développé couché barre"
              placeholderTextColor={theme.colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Groupe musculaire</Text>
            <View style={styles.muscleGrid}>
              {MUSCLE_GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.muscleChip, newMuscle === g && { backgroundColor: theme.colors.primary }]}
                  onPress={() => setNewMuscle(g)}
                >
                  <View style={[styles.dot, { backgroundColor: muscleColors[g] ?? '#888' }]} />
                  <Text style={[styles.muscleChipText, newMuscle === g && { color: '#fff' }]}>
                    {muscleGroupLabel(g)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pageTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text },
  addBtn: {
    backgroundColor: theme.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, color: theme.colors.textMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowName: { fontSize: 15, color: theme.colors.text },
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  cancelText: { fontSize: 16, color: theme.colors.textSecondary },
  saveText: { fontSize: 16, color: theme.colors.primary, fontWeight: '600' },
  formGroup: { padding: theme.spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  muscleChipText: { fontSize: 13, color: theme.colors.text },
});
