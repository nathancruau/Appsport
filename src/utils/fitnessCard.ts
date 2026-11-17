import { MuscleGroupStat } from '../database/database';

function clamp(v: number): number { return Math.max(0, Math.min(100, Math.round(v))); }

export interface FitnessAttribute { key: string; label: string; score: number; }

export type FifaTier = 'bronze' | 'silver' | 'gold' | 'elite' | 'toty';

export interface FitnessCard {
  ovr: number;
  tier: FifaTier;
  tierLabel: string;
  cardBg: string;
  accent: string;
  textOnCard: string;
  attributes: FitnessAttribute[];
  radarData: { label: string; value: number }[];
}

const MG_LABELS: Record<string, string> = {
  chest: 'PEC', back: 'DOS', legs: 'JAM', shoulders: 'EPL',
  arms: 'BRA', core: 'ABS', cardio: 'CAR', other: 'AUT',
};

function scoreReg(sessions90: number): number {
  return clamp(sessions90 / 12 * 100);
}

function scoreVol(vol90: number): number {
  if (vol90 <= 0) return 0;
  return clamp(Math.log10(vol90 + 1) / Math.log10(55000) * 100);
}

function scoreProg(stat: MuscleGroupStat): number {
  if (stat.recentSessions === 0) return 0;
  if (stat.earlySessions === 0) return 50;
  const recentAvg = stat.recentVol / stat.recentSessions;
  const earlyAvg = stat.earlyVol / stat.earlySessions;
  if (earlyAvg === 0) return 50;
  const ratio = recentAvg / earlyAvg;
  return clamp((ratio - 0.5) / 1.5 * 100);
}

function scoreMuscle(stat: MuscleGroupStat): number {
  if (stat.sessions === 0) return 0;
  const reg = scoreReg(stat.sessions);
  const vol = scoreVol(stat.volume);
  const prog = scoreProg(stat);
  return clamp(reg * 0.35 + vol * 0.40 + prog * 0.25);
}

const TIERS: { min: number; tier: FifaTier; label: string; cardBg: string; accent: string; text: string }[] = [
  { min: 85, tier: 'toty',   label: 'TOTY',   cardBg: '#06090F', accent: '#FFD700', text: '#FFE566' },
  { min: 75, tier: 'elite',  label: 'ÉLITE',  cardBg: '#120520', accent: '#BF5AF2', text: '#D88EFF' },
  { min: 65, tier: 'gold',   label: 'OR',     cardBg: '#161200', accent: '#D4AF37', text: '#F5D060' },
  { min: 50, tier: 'silver', label: 'ARGENT', cardBg: '#141820', accent: '#8AAABB', text: '#B0CDD8' },
  { min:  0, tier: 'bronze', label: 'BRONZE', cardBg: '#160C04', accent: '#B07040', text: '#D49060' },
];

export function computeFitnessCardFromMuscles(
  muscleStats: Record<string, MuscleGroupStat>
): FitnessCard {
  const ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'other'];
  const empty: MuscleGroupStat = { sessions: 0, volume: 0, recentVol: 0, earlyVol: 0, recentSessions: 0, earlySessions: 0 };
  const scored = ORDER
    .map((key) => ({ key, label: MG_LABELS[key], score: scoreMuscle(muscleStats[key] ?? empty) }))
    .filter((x) => (muscleStats[x.key]?.sessions ?? 0) > 0);

  const ovr = scored.length === 0 ? 0 : clamp(scored.reduce((s, x) => s + x.score, 0) / scored.length);
  const t = TIERS.find((x) => ovr >= x.min) ?? TIERS[TIERS.length - 1];

  const topAttrs = [...scored].sort((a, b) => (muscleStats[b.key]?.sessions ?? 0) - (muscleStats[a.key]?.sessions ?? 0)).slice(0, 6);
  const radarData = scored.map((x) => ({ label: x.label, value: x.score }));

  return {
    ovr, tier: t.tier, tierLabel: t.label,
    cardBg: t.cardBg, accent: t.accent, textOnCard: t.text,
    attributes: topAttrs,
    radarData,
  };
}

export function computeFitnessCard(
  sessions30: number, volume30: number, _streakWeeks: number, _sessions7: number
): FitnessCard {
  const fake: Record<string, MuscleGroupStat> = {};
  if (sessions30 > 0) {
    fake['other'] = {
      sessions: sessions30 * 3,
      volume: volume30 * 3,
      recentVol: volume30,
      earlyVol: volume30 * 2,
      recentSessions: sessions30,
      earlySessions: sessions30 * 2,
    };
  }
  return computeFitnessCardFromMuscles(fake);
}
