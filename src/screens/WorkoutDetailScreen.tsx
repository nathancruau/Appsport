import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Platform, Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme, muscleColors } from '../theme';
import { RootStackParamList, Workout } from '../types';
import { getWorkoutDetail, WorkoutExerciseDetail, deleteWorkout, saveTemplate } from '../database/database';
import { formatDateFull, formatDuration, muscleGroupLabel, formatWeight } from '../utils/calculations';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;

export default function WorkoutDetailScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExerciseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [alertModal, setAlertModal] = useState<{
    title: string; message: string;
    buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
  } | null>(null);

  useEffect(() => {
    getWorkoutDetail(params.workoutId).then(({ workout, exercises }) => {
      setWorkout(workout);
      setExercises(exercises);
      setLoading(false);
    });
  }, [params.workoutId]);

  const showAlert = (
    title: string, message: string,
    buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'OK' }]
  ) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, buttons.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress })));
    } else {
      setAlertModal({ title, message, buttons });
    }
  };

  const handleDelete = () => {
    showAlert('Supprimer cette séance ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await deleteWorkout(params.workoutId);
          navigation.goBack();
        },
      },
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
          {workout.name && <Text style={styles.name}>{workout.name}</Text>}
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

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setTemplateName(workout.name ?? ''); setShowSaveTemplate(true); }}
            >
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
          const vol = ex.sets
            .filter((s) => !s.isWarmup && s.completed && s.reps && s.weight)
            .reduce((sum, s) => sum + s.reps! * s.weight!, 0);

          return (
            <TouchableOpacity
              key={ex.id}
              style={styles.exCard}
              onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.exerciseId, exerciseName: ex.exerciseName })}
              activeOpacity={0.75}
            >
              <View style={styles.exHeader}>
                <View style={[styles.dot, { backgroundColor: muscleColors[ex.muscleGroup] ?? '#888' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.exerciseName}</Text>
                  <Text style={styles.exMuscle}>{muscleGroupLabel(ex.muscleGroup)}</Text>
                </View>
                {vol > 0 && <Text style={styles.exVol}>{Math.round(vol).toLocaleString('fr')} kg</Text>}
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
              </View>

              <View style={styles.setHeader}>
                <Text style={[styles.setCell, { width: 28 }]}>#</Text>
                <Text style={[styles.setCell, { flex: 1 }]}>Poids</Text>
                <Text style={[styles.setCell, { flex: 1 }]}>Reps</Text>
              </View>
              {ex.sets.map((s, i) => (
                <View key={s.id} style={[styles.setRow, s.isWarmup && styles.setWarmup]}>
                  <Text style={styles.setNum}>{s.isWarmup ? 'E' : i + 1 - warmupSets.filter((_, wi) => wi < i).length}</Text>
                  <Text style={styles.setValue}>{s.weight != null ? `${formatWeight(s.weight)} kg` : '—'}</Text>
                  <Text style={styles.setValue}>{s.reps ?? '—'}</Text>
                </View>
              ))}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
        </Modal>
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
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  date: { fontSize: 13, color: theme.colors.textMuted, textTransform: 'capitalize', marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border,
  },
  actionBtnDanger: { backgroundColor: '#FFF0F0', borderColor: theme.colors.error + '40' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  exCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
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
  modal: { flex: 1, backgroundColor: theme.colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  cancelText: { fontSize: 16, color: theme.colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md, padding: 12, fontSize: 16, color: theme.colors.text, marginBottom: 10 },
  exList: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 20 },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
});
