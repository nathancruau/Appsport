import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator, ScrollView, Modal, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, Workout, WorkoutTemplate } from '../types';
import { getRecentWorkouts, getTemplates, deleteTemplate, getRestTimerSettings, saveRestTimerSettings, RestTimerSettings, getPausedWorkout, getTrainingStreak } from '../database/database';
import { formatDate, formatDuration, parseLocalDate } from '../utils/calculations';
import { useAuth } from '../context/AuthContext';
import { version } from '../../package.json';
import { computeFitnessLevel } from '../utils/fitnessLevel'; // still used for level.emoji + level.label in FIFA card
import { computeFitnessCard } from '../utils/fitnessCard';
import { drawFavicon } from '../utils/drawFavicon';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };
type WorkoutItem = Workout & { exerciseCount: number; totalVolume: number };
type AlertBtn = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; buttons: AlertBtn[] } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState<RestTimerSettings>({ enabled: true, durationSeconds: 90, showRPE: true });
  const [hasPausedWorkout, setHasPausedWorkout] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sessions30, setSessions30] = useState(0);
  const [volume30, setVolume30] = useState(0);
  const [sessions7, setSessions7] = useState(0);
  const [showLevelInfo, setShowLevelInfo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getRecentWorkouts(50), getTemplates(), getRestTimerSettings(), getPausedWorkout(), getTrainingStreak()]).then(([data, tmpl, settings, paused, str]) => {
        if (!active) return;
        const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30); cutoff30.setHours(0, 0, 0, 0);
        const recent30 = data.filter((w) => parseLocalDate(w.date) >= cutoff30);
        const count30 = recent30.length;
        const vol30 = recent30.reduce((s, w) => s + w.totalVolume, 0);
        // Current week: Monday 00:00 → Sunday 23:59
        const now = new Date();
        const dow = now.getDay(); // 0=Sun
        const daysSinceMon = dow === 0 ? 6 : dow - 1;
        const monday = new Date(now); monday.setDate(now.getDate() - daysSinceMon); monday.setHours(0, 0, 0, 0);
        const thisWeek = data.filter((w) => parseLocalDate(w.date) >= monday);
        setWorkouts(data.slice(0, 5));
        setTemplates(tmpl);
        setAppSettings(settings);
        setHasPausedWorkout(!!paused);
        setStreak(str);
        setSessions30(count30);
        setVolume30(vol30);
        setSessions7(thisWeek.length);
        drawFavicon(count30, vol30);
        setLoading(false);
      });
      return () => { active = false; };
    }, [])
  );

  const showAlert = (title: string, message: string, buttons: AlertBtn[]) => {
    setAlertModal({ title, message, buttons });
  };

  const confirmDeleteTemplate = (t: WorkoutTemplate) => {
    showAlert('Supprimer le template ?', `"${t.name}" sera supprimé.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await deleteTemplate(t.id);
        setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      }},
    ]);
  };

  const thisWeekCount = sessions7;

  const level = computeFitnessLevel(sessions30);
  const card = computeFitnessCard(sessions30, volume30, streak, sessions7);

  const renderWorkout = ({ item }: { item: WorkoutItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
      activeOpacity={0.75}
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardInner}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            <Text style={styles.cardTitle}>{item.name ?? 'Séance'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </View>
        <View style={styles.cardStats}>
          <View style={styles.statChip}>
            <Ionicons name="barbell-outline" size={12} color={theme.colors.primary} />
            <Text style={styles.statText}>{item.exerciseCount} ex.</Text>
          </View>
          {item.totalVolume > 0 && (
            <View style={styles.statChip}>
              <Ionicons name="trending-up-outline" size={12} color={theme.colors.primary} />
              <Text style={styles.statText}>{(item.totalVolume / 1000).toFixed(1)}t</Text>
            </View>
          )}
          {item.duration != null && (
            <View style={styles.statChip}>
              <Ionicons name="time-outline" size={12} color={theme.colors.primary} />
              <Text style={styles.statText}>{formatDuration(item.duration * 60)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {user ? `Bonjour ${user.displayName?.split(' ')[0] ?? ''} 💪` : 'Bonjour 💪'}
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {thisWeekCount > 0
                ? `${thisWeekCount} séance${thisWeekCount > 1 ? 's' : ''} cette semaine`
                : 'Prêt pour une séance ?'}
            </Text>
            {streak >= 2 && (
              <View style={styles.streakChip}>
                <Text style={styles.streakText}>🔥 {streak} sem.</Text>
              </View>
            )}
          </View>
          <Text style={styles.versionText}>v{version}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {user ? (
            <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowSettings(true)}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{(user.displayName ?? user.email ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.syncDot} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.signInBtn} onPress={signInWithGoogle}>
              <Ionicons name="logo-google" size={13} color={theme.colors.primary} />
              <Text style={styles.signInText}>Connexion</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.levelChip, { backgroundColor: card.cardBg, borderColor: card.accent + '80' }]}
            onPress={() => setShowLevelInfo(true)}
          >
            <Text style={[styles.levelChipOvr, { color: card.accent }]}>{card.ovr}</Text>
            <Text style={[styles.levelChipTier, { color: card.textOnCard }]}>{card.tierLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {hasPausedWorkout && (
        <TouchableOpacity
          style={styles.resumeBtn}
          onPress={() => navigation.navigate('ActiveWorkout', { resume: true })}
          activeOpacity={0.85}
        >
          <Ionicons name="play-circle" size={20} color="#fff" />
          <Text style={styles.resumeBtnText}>Reprendre la séance en cours</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}

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
            style={{ marginBottom: theme.spacing.md, maxHeight: 28 }}
            contentContainerStyle={{ gap: 6, paddingRight: 16, alignItems: 'center' }}
          >
            {templates.map((t) => (
              <View key={t.id} style={styles.templateChip}>
                <TouchableOpacity
                  style={styles.templateChipMain}
                  onPress={() => navigation.navigate('ActiveWorkout', { templateExerciseIds: t.exerciseIds })}
                  activeOpacity={0.75}
                >
                  <Ionicons name="flash" size={11} color={theme.colors.primary} />
                  <Text style={styles.templateChipText}>{t.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDeleteTemplate(t)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  <Ionicons name="close" size={12} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
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

      {/* Custom alert (Alert.alert bloqué en PWA) */}
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

      {/* FIFA Card Overlay */}
      {showLevelInfo && (
        <View style={[StyleSheet.absoluteFillObject, styles.fifaOverlay]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowLevelInfo(false)} />
          <View style={[styles.fifaCard, { backgroundColor: card.cardBg }]}>
            {/* Subtle inner glow border */}
            <View style={[styles.fifaCardInner, { borderColor: card.accent + '40' }]}>

              {/* Top band */}
              <View style={styles.fifaTop}>
                <View>
                  <Text style={[styles.fifaOvr, { color: card.accent }]}>{card.ovr}</Text>
                  <Text style={[styles.fifaTierLabel, { color: card.textOnCard }]}>{card.tierLabel}</Text>
                  <Text style={[styles.fifaPos, { color: card.textOnCard + 'AA' }]}>{level.label.toUpperCase()}</Text>
                </View>
                <View style={[styles.fifaEmojiCircle, { borderColor: card.accent + '60', backgroundColor: card.accent + '18' }]}>
                  <Text style={styles.fifaEmoji}>{level.emoji}</Text>
                </View>
              </View>

              {/* Name */}
              <Text style={[styles.fifaName, { color: card.accent }]} numberOfLines={1}>
                {user?.displayName?.split(' ')[0]?.toUpperCase() ?? 'ATHLÈTE'}
              </Text>

              {/* Divider */}
              <View style={[styles.fifaDivider, { backgroundColor: card.accent + '40' }]} />

              {/* Stats */}
              <View style={styles.fifaStats}>
                {card.attributes.map((attr) => (
                  <View key={attr.key} style={styles.fifaStat}>
                    <Text style={[styles.fifaStatVal, { color: card.accent }]}>{attr.score}</Text>
                    <Text style={[styles.fifaStatLabel, { color: card.textOnCard + 'AA' }]}>{attr.label}</Text>
                  </View>
                ))}
              </View>

              {/* Raw data row */}
              <View style={[styles.fifaRawRow, { borderTopColor: card.accent + '20' }]}>
                <Text style={[styles.fifaRaw, { color: card.textOnCard + '70' }]}>
                  {sessions30} séances · {volume30 >= 1000 ? `${(volume30 / 1000).toFixed(1)}t` : `${Math.round(volume30)}kg`} · {streak} sem.
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Settings Overlay */}
      {showSettings && (
        <View style={[StyleSheet.absoluteFillObject, styles.settingsOverlay]}>
          <View style={[styles.settingsHeader, { paddingTop: Math.max(insets.top, 16) }]}>
            <Text style={styles.settingsTitle}>Paramètres</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {user && (
            <View style={styles.settingsUserRow}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.settingsAvatar} />
              ) : (
                <View style={[styles.settingsAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{(user.displayName ?? user.email ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsUserName}>{user.displayName ?? 'Utilisateur'}</Text>
                <Text style={styles.settingsUserEmail}>{user.email ?? ''}</Text>
              </View>
            </View>
          )}

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Séance</Text>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={async () => {
                const updated = { ...appSettings, showRPE: !appSettings.showRPE };
                setAppSettings(updated);
                await saveRestTimerSettings(updated);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsRowLabel}>Afficher le RPE</Text>
                <Text style={styles.settingsRowSub}>Ressenti perçu après chaque série</Text>
              </View>
              <View style={[styles.toggle, appSettings.showRPE && styles.toggleOn]}>
                <View style={[styles.toggleThumb, appSettings.showRPE && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
          </View>

          {user && (
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Compte</Text>
              <View style={styles.settingsRow}>
                <View style={styles.syncIndicator}>
                  <View style={styles.syncDotSmall} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsRowLabel}>Synchronisé avec Google</Text>
                  <Text style={styles.settingsRowSub}>Tes données sont sauvegardées dans le cloud</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.settingsRow, { borderBottomWidth: 0 }]}
                onPress={async () => { setShowSettings(false); await signOut(); }}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.colors.error} style={{ marginRight: 10 }} />
                <Text style={[styles.settingsRowLabel, { color: theme.colors.error }]}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm },
  greeting: { fontSize: 26, fontWeight: '700', color: theme.colors.text },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  streakChip: { backgroundColor: '#FFF3E0', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#E65100' },
  versionText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  avatarBtn: { position: 'relative', marginTop: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 15, fontWeight: '700' },
  syncDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759', borderWidth: 1.5, borderColor: theme.colors.background },
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  signInText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  levelChip: {
    alignItems: 'center', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, minWidth: 48,
  },
  levelChipOvr: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  levelChipTier: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 },
  // FIFA card overlay
  fifaOverlay: {
    backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  fifaCard: {
    width: 260, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 30,
  },
  fifaCardInner: {
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  fifaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  fifaOvr: { fontSize: 52, fontWeight: '900', lineHeight: 52 },
  fifaTierLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  fifaPos: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  fifaEmojiCircle: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  fifaEmoji: { fontSize: 36 },
  fifaName: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 },
  fifaDivider: { height: 1, marginBottom: 14 },
  fifaStats: { flexDirection: 'row', justifyContent: 'space-between' },
  fifaStat: { alignItems: 'center', flex: 1 },
  fifaStatVal: { fontSize: 18, fontWeight: '800' },
  fifaStatLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  fifaRawRow: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, alignItems: 'center' },
  fifaRaw: { fontSize: 10 },
  startButton: {
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, marginBottom: theme.spacing.lg,
  },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resumeBtn: {
    backgroundColor: '#FF9F0A', borderRadius: theme.radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 16, marginBottom: theme.spacing.sm,
  },
  resumeBtnText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  // Template chips
  templateChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, borderRadius: theme.radius.full,
    paddingLeft: 7, paddingRight: 5, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.colors.border, gap: 3,
  },
  templateChipMain: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingRight: 2 },
  templateChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.text },
  // Cards
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm, flexDirection: 'row', overflow: 'hidden',
  },
  cardAccent: { width: 4, backgroundColor: theme.colors.primary + 'CC' },
  cardInner: { flex: 1, padding: theme.spacing.md },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardDate: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'capitalize', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  cardStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.primary + '14', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statText: { fontSize: 11, color: theme.colors.primary, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  // Alert
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  // Settings overlay
  settingsOverlay: { backgroundColor: theme.colors.background, zIndex: 100 },
  settingsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  settingsTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  settingsUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  settingsAvatar: { width: 44, height: 44, borderRadius: 22 },
  settingsUserName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  settingsUserEmail: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  settingsSection: {
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md, overflow: 'hidden',
  },
  settingsSectionTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: 12, paddingBottom: 0 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  settingsRowLabel: { fontSize: 15, color: theme.colors.text, fontWeight: '500' },
  settingsRowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  syncIndicator: { width: 28, alignItems: 'center', justifyContent: 'center' },
  syncDotSmall: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: theme.colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
});
