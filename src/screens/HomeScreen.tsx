import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator, ScrollView, Modal, Image, Animated, PanResponder,
} from 'react-native';
import Svg, {
  Polygon, Line, Circle, Text as SvgText,
  Rect as SvgRect, Defs, LinearGradient as SvgLinearGradient,
  Stop, Path as SvgPath, Ellipse as SvgEllipse,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList, Workout, WorkoutTemplate } from '../types';
import { getRecentWorkouts, getTemplates, deleteTemplate, getRestTimerSettings, saveRestTimerSettings, RestTimerSettings, getPausedWorkout, getTrainingStreak, getMuscleGroupStats90, saveFitnessCardOvr, loadFitnessCardOvr, saveFitnessTier, loadFitnessTier } from '../database/database';
import { formatDate, formatDuration, parseLocalDate } from '../utils/calculations';
import { useAuth } from '../context/AuthContext';
import { version } from '../../package.json';
import { computeFitnessLevel } from '../utils/fitnessLevel';
import { computeFitnessCardFromMuscles, FitnessCard } from '../utils/fitnessCard';
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
  const [ovrDelta, setOvrDelta] = useState<number | null>(null);
  const [muscleCard, setMuscleCard] = useState<FitnessCard | null>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [cardFlipped, setCardFlipped] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [tierUpLabel, setTierUpLabel] = useState('');
  const confettiParticles = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      color: ['#FFD700', '#FF4444', '#44DD44', '#4488FF', '#FF88CC', '#FF8C00', '#CC44FF'][i % 7],
      size: 7 + (i % 4) * 2,
    }))
  ).current;

  const launchConfetti = () => {
    confettiParticles.forEach((p, i) => {
      const angle = (i / 22) * Math.PI * 2;
      const dist = 90 + (i % 5) * 28;
      p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(1); p.rotate.setValue(0);
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 1300, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.y, { toValue: -(70 + (i % 4) * 35), duration: 520, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: 320, duration: 780, useNativeDriver: true }),
        ]),
        Animated.timing(p.rotate, { toValue: 480 + (i % 3) * 240, duration: 1300, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(750),
          Animated.timing(p.opacity, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
      ]).start();
    });
    setTimeout(() => setShowConfetti(false), 2800);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getRecentWorkouts(50), getTemplates(), getRestTimerSettings(),
        getPausedWorkout(), getTrainingStreak(),
        getMuscleGroupStats90(), loadFitnessCardOvr(), loadFitnessTier(),
      ]).then(([data, tmpl, settings, paused, str, mgStats, prevOvr, prevTier]) => {
        if (!active) return;
        const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30); cutoff30.setHours(0, 0, 0, 0);
        const recent30 = (data as WorkoutItem[]).filter((w) => parseLocalDate(w.date) >= cutoff30);
        const count30 = recent30.length;
        const vol30 = recent30.reduce((s, w) => s + w.totalVolume, 0);
        const now = new Date();
        const dow = now.getDay();
        const daysSinceMon = dow === 0 ? 6 : dow - 1;
        const monday = new Date(now); monday.setDate(now.getDate() - daysSinceMon); monday.setHours(0, 0, 0, 0);
        const thisWeek = (data as WorkoutItem[]).filter((w) => parseLocalDate(w.date) >= monday);
        const newCard = computeFitnessCardFromMuscles(mgStats as any);
        const delta = prevOvr != null ? newCard.ovr - (prevOvr as number) : null;
        const TIER_ORDER: Record<string, number> = { bronze: 0, silver: 1, gold: 2, elite: 3, toty: 4 };
        const tierImproved = prevTier && TIER_ORDER[newCard.tier] > (TIER_ORDER[prevTier as string] ?? -1);
        setWorkouts((data as WorkoutItem[]).slice(0, 5));
        setTemplates(tmpl as any);
        setAppSettings(settings as any);
        setHasPausedWorkout(!!(paused as any));
        setStreak(str as number);
        setSessions30(count30);
        setVolume30(vol30);
        setSessions7(thisWeek.length);
        setMuscleCard(newCard);
        setOvrDelta(delta);
        drawFavicon(count30, vol30);
        saveFitnessCardOvr(newCard.ovr);
        saveFitnessTier(newCard.tier);
        if (tierImproved) {
          setTierUpLabel(newCard.tierLabel);
          setShowConfetti(true);
          launchConfetti();
        }
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
  const card = muscleCard ?? { ovr: 0, tier: 'bronze' as const, tierLabel: 'BRONZE', cardBg: '#160C04', accent: '#B07040', textOnCard: '#D49060', attributes: [], radarData: [] };

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

  const flipCard = () => {
    Animated.spring(flipAnim, {
      toValue: cardFlipped ? 0 : 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
    setCardFlipped(!cardFlipped);
  };

  const handleOpenCard = () => {
    setCardFlipped(false);
    flipAnim.setValue(0);
    setShowLevelInfo(true);
  };

  const handleCloseCard = () => {
    setShowLevelInfo(false);
    setCardFlipped(false);
    flipAnim.setValue(0);
  };

  const swipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => { if (Math.abs(gs.dx) > 44) flipCard(); },
    })
  ).current;

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const renderRadarChart = (data: { label: string; value: number }[], accentColor: string, textColor: string) => {
    if (data.length < 3) return null;
    const SIZE = 220; const CENTER = SIZE / 2; const RADIUS = 76;
    const n = data.length;
    const angles = data.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);
    const pts = data.map((d, i) => ({
      x: CENTER + (d.value / 100) * RADIUS * Math.cos(angles[i]),
      y: CENTER + (d.value / 100) * RADIUS * Math.sin(angles[i]),
    }));
    const polygon = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const grids = [25, 50, 75, 100].map((pct) =>
      angles.map((a) => { const r = (pct / 100) * RADIUS; return `${CENTER + r * Math.cos(a)},${CENTER + r * Math.sin(a)}`; }).join(' ')
    );
    return (
      <Svg width={SIZE} height={SIZE}>
        {grids.map((gp, gi) => <Polygon key={gi} points={gp} fill="none" stroke={accentColor + '25'} strokeWidth={0.8} />)}
        {angles.map((a, i) => <Line key={i} x1={CENTER} y1={CENTER} x2={CENTER + RADIUS * Math.cos(a)} y2={CENTER + RADIUS * Math.sin(a)} stroke={accentColor + '30'} strokeWidth={0.8} />)}
        <Polygon points={polygon} fill={accentColor + '28'} stroke={accentColor} strokeWidth={2} />
        {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4} fill={accentColor} />)}
        {data.map((d, i) => {
          const lr = RADIUS + 20;
          const lx = CENTER + lr * Math.cos(angles[i]);
          const ly = CENTER + lr * Math.sin(angles[i]);
          return (
            <React.Fragment key={i}>
              <SvgText x={lx} y={ly - 4} fill={textColor} fontSize={9} textAnchor="middle" fontWeight="700">{d.label}</SvgText>
              <SvgText x={lx} y={ly + 7} fill={accentColor} fontSize={9} textAnchor="middle" fontWeight="800">{d.value}</SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  const renderMedal = (tier: FitnessCard['tier'], accent: string) => {
    type Cfg = { medal: string; r1: string; r2: string; stars: number; shine: string };
    const cfgs: Record<string, Cfg> = {
      bronze: { medal: '#CD7F32', r1: '#7A3A0A', r2: '#A05020', stars: 1, shine: '#E8A87C' },
      silver: { medal: '#C0C0C0', r1: '#3A5A7A', r2: '#5080A0', stars: 2, shine: '#E8E8E8' },
      gold:   { medal: '#D4AF37', r1: '#8B1A1A', r2: '#BB2222', stars: 3, shine: '#FFE566' },
      elite:  { medal: '#9B59B6', r1: '#4A1A70', r2: '#7030A0', stars: 4, shine: '#D088FF' },
      toty:   { medal: '#E8C842', r1: '#7A5800', r2: '#A07820', stars: 5, shine: '#FFF5A0' },
    };
    const c = cfgs[tier] ?? cfgs.bronze;
    const W = 130; const H = 150; const cx = W / 2;
    const medalY = 108; const R = 36;
    const starPath = (sx: number, sy: number, r: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${sx + rr * Math.cos(a)},${sy + rr * Math.sin(a)}`);
      }
      return pts.join(' ');
    };
    const totalStarW = c.stars * 18 - 2;
    return (
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <SvgRect x={cx - 12} y={0} width={10} height={70} rx={2} fill={c.r1} />
        <SvgRect x={cx + 2} y={0} width={10} height={70} rx={2} fill={c.r2} />
        <SvgEllipse cx={cx} cy={70} rx={15} ry={7} fill={c.r1} />
        <Circle cx={cx} cy={medalY} r={R + 6} fill={c.medal + '30'} />
        <Circle cx={cx} cy={medalY} r={R} fill={c.medal} />
        <Circle cx={cx} cy={medalY} r={R - 5} fill="none" stroke={c.shine} strokeWidth={2} opacity={0.5} />
        <Circle cx={cx} cy={medalY} r={R - 11} fill={c.medal + 'CC'} />
        {Array.from({ length: c.stars }, (_, i) => {
          const sx = cx - totalStarW / 2 + 9 + i * 18;
          return <Polygon key={i} points={starPath(sx, medalY, 7)} fill={c.shine} />;
        })}
      </Svg>
    );
  };

  const renderFifaBg = (tier: FitnessCard['tier'], accent: string) => {
    const gradients: Record<string, [string, string, string]> = {
      bronze: ['#2A0A00', '#7A3810', '#B06030'],
      silver: ['#0A1420', '#1E3A54', '#4A6A80'],
      gold:   ['#1E1000', '#6A4800', '#B08020'],
      elite:  ['#080216', '#250850', '#4A1888'],
      toty:   ['#000408', '#080F28', '#141E48'],
    };
    const [c1, c2, c3] = gradients[tier] ?? gradients.bronze;
    return (
      <Svg style={StyleSheet.absoluteFillObject as any} width="280" height="380">
        <Defs>
          <SvgLinearGradient id={`bg_${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="50%" stopColor={c2} />
            <Stop offset="100%" stopColor={c3} />
          </SvgLinearGradient>
        </Defs>
        <SvgRect width="280" height="380" fill={`url(#bg_${tier})`} rx={16} />
        <SvgPath d="M 280 0 L 100 0 L 280 170 Z" fill={accent + '12'} />
        <SvgPath d="M 280 0 L 170 0 L 280 90 Z" fill={accent + '18'} />
        {[0,1,2,3].flatMap(row => [0,1,2,3].map(col => (
          <SvgText key={`tl${row}${col}`} x={8+col*17} y={17+row*17} fill={accent+'22'} fontSize={12} textAnchor="middle">+</SvgText>
        )))}
        {[0,1,2,3].flatMap(row => [0,1,2,3].map(col => (
          <SvgText key={`tr${row}${col}`} x={212+col*17} y={17+row*17} fill={accent+'22'} fontSize={12} textAnchor="middle">+</SvgText>
        )))}
      </Svg>
    );
  };

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
            onPress={handleOpenCard}
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

      {/* Custom alert */}
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
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handleCloseCard} />

          <View style={{ alignItems: 'center', gap: 14 }} {...swipePan.panHandlers}>

            {/* Front face */}
            <Animated.View
              style={[styles.fifaCard, { transform: [{ rotateY: frontRotate }], backfaceVisibility: 'hidden' }]}
              pointerEvents={cardFlipped ? 'none' : 'auto'}
            >
              {renderFifaBg(card.tier, card.accent)}
              <View style={styles.fifaTopSection}>
                <View style={styles.fifaLeftCol}>
                  <Text style={[styles.fifaOvr, { color: card.accent }]}>{card.ovr}</Text>
                  <Text style={[styles.fifaTierLabel, { color: card.textOnCard }]}>{card.tierLabel}</Text>
                  <Text style={[styles.fifaPos, { color: card.textOnCard + 'AA' }]}>{level.label.toUpperCase()}</Text>
                  <View style={{ marginTop: 10 }}>
                    <Svg width={34} height={20}>
                      <SvgRect x={0} y={6} width={34} height={8} rx={2} fill={card.accent + '50'} />
                      <SvgRect x={0} y={2} width={7} height={16} rx={2} fill={card.accent} />
                      <SvgRect x={27} y={2} width={7} height={16} rx={2} fill={card.accent} />
                    </Svg>
                  </View>
                </View>
                <View style={styles.fifaMedalArea}>
                  {renderMedal(card.tier, card.accent)}
                </View>
              </View>

              <View style={styles.fifaNameBand}>
                <Text style={[styles.fifaName, { color: card.accent }]} numberOfLines={1}>
                  {user?.displayName?.split(' ')[0]?.toUpperCase() ?? 'ATHLÈTE'}
                </Text>
              </View>

              <View style={styles.fifaStatsGrid}>
                <View style={styles.fifaStatsCol}>
                  {card.attributes.slice(0, 3).map((attr) => (
                    <View key={attr.key} style={styles.fifaStatRow}>
                      <Text style={[styles.fifaStatVal, { color: card.accent }]}>{attr.score}</Text>
                      <Text style={[styles.fifaStatLabel, { color: card.textOnCard + 'AA' }]}>{attr.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.fifaStatsDivider, { backgroundColor: card.accent + '30' }]} />
                <View style={styles.fifaStatsCol}>
                  {card.attributes.slice(3, 6).map((attr) => (
                    <View key={attr.key} style={styles.fifaStatRow}>
                      <Text style={[styles.fifaStatVal, { color: card.accent }]}>{attr.score}</Text>
                      <Text style={[styles.fifaStatLabel, { color: card.textOnCard + 'AA' }]}>{attr.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={[styles.fifaSwipeHint, { color: card.textOnCard + '50' }]}>← glisser pour radar →</Text>
            </Animated.View>

            {/* Back face (radar) */}
            <Animated.View
              style={[styles.fifaCard, styles.fifaCardBack, { transform: [{ rotateY: backRotate }], backfaceVisibility: 'hidden' }]}
              pointerEvents={cardFlipped ? 'auto' : 'none'}
            >
              {renderFifaBg(card.tier, card.accent)}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
                <Text style={[styles.fifaBackTitle, { color: card.textOnCard + '80' }]}>ANALYSE MUSCULAIRE</Text>
                {card.radarData.length >= 3
                  ? renderRadarChart(card.radarData, card.accent, card.textOnCard)
                  : <Text style={[styles.fifaNoData, { color: card.textOnCard + '60' }]}>Pas assez de données</Text>
                }
                <Text style={[styles.fifaSwipeHint, { color: card.textOnCard + '50', marginTop: 4 }]}>← glisser pour revenir →</Text>
              </View>
            </Animated.View>

          </View>

          {ovrDelta !== null && Math.abs(ovrDelta) >= 0.5 && (
            <Text style={styles.fifaDelta}>
              {ovrDelta > 0 ? `+${ovrDelta.toFixed(1)}` : ovrDelta.toFixed(1)} depuis la dernière séance
            </Text>
          )}

          {/* Confetti tier-up */}
          {showConfetti && (
            <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' as any, alignItems: 'center', justifyContent: 'center' }]}>
              <View style={styles.tierUpBanner}>
                <Text style={styles.tierUpText}>🎉 Nouveau tier : {tierUpLabel} !</Text>
              </View>
              {confettiParticles.map((p, i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: p.size, height: p.size,
                    backgroundColor: p.color,
                    borderRadius: p.size / 4,
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { rotate: p.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                    ],
                    opacity: p.opacity,
                  }}
                />
              ))}
            </View>
          )}
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
    backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 100,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  fifaCard: {
    width: 280, height: 380, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.75, shadowRadius: 40, elevation: 40,
  },
  fifaCardBack: {
    position: 'absolute', top: 0, left: 0,
  },
  fifaTopSection: {
    flexDirection: 'row', height: 220, paddingTop: 14,
  },
  fifaLeftCol: {
    width: 72, paddingLeft: 14, paddingTop: 2,
  },
  fifaOvr: { fontSize: 54, fontWeight: '900', lineHeight: 54 },
  fifaTierLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginTop: 2 },
  fifaPos: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  fifaMedalArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingRight: 10,
  },
  fifaNameBand: {
    backgroundColor: 'rgba(0,0,0,0.72)', height: 40,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 12,
  },
  fifaName: { fontSize: 21, fontWeight: '900', letterSpacing: 2 },
  fifaStatsGrid: {
    flex: 1, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
  },
  fifaStatsCol: { flex: 1, justifyContent: 'space-around' },
  fifaStatsDivider: { width: 1, marginVertical: 4 },
  fifaStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fifaStatVal: { fontSize: 20, fontWeight: '900', width: 30 },
  fifaStatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  fifaSwipeHint: { fontSize: 10, textAlign: 'center', paddingBottom: 8 },
  fifaBackTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 4 },
  fifaNoData: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 40 },
  fifaDelta: { fontSize: 13, color: '#8BC34A', fontWeight: '600', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tierUpBanner: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FFD70060',
  },
  tierUpText: { color: '#FFD700', fontSize: 16, fontWeight: '800', textAlign: 'center' },
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
  templateChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, borderRadius: theme.radius.full,
    paddingLeft: 7, paddingRight: 5, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.colors.border, gap: 3,
  },
  templateChipMain: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingRight: 2 },
  templateChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.text },
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
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertBox: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, width: '100%', maxWidth: 340 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
  alertMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  alertButtons: { gap: 8 },
  alertBtn: { paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' },
  alertBtnDestructive: { backgroundColor: '#FFF0F0' },
  alertBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
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
