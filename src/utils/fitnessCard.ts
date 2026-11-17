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
}

// REG: sessions in last 30 days (4/month = moderate, 16+/month = max)
function scoreReg(s30: number): number { return clamp(s30 / 16 * 100); }

// VOL: volume in kg last 30 days — log scale (10 000 kg ≈ 70, 50 000 kg ≈ 100)
function scoreVol(vol: number): number {
  if (vol <= 0) return 0;
  return clamp(Math.log10(vol + 1) / Math.log10(50000) * 100);
}

// CON: streak in weeks (12+ weeks = 100)
function scoreCon(weeks: number): number { return clamp(weeks / 12 * 100); }

// FRQ: sessions this week (5+/week = 100)
function scoreFrq(s7: number): number { return clamp(s7 / 5 * 100); }

// EFF: volume per session — log scale (3 000 kg/session ≈ 70, 10 000 ≈ 100)
function scoreEff(volPerSession: number): number {
  if (volPerSession <= 0) return 0;
  return clamp(Math.log10(volPerSession + 1) / Math.log10(10000) * 100);
}

const TIERS: { min: number; tier: FifaTier; label: string; cardBg: string; accent: string; text: string }[] = [
  { min: 85, tier: 'toty',   label: 'TOTY',   cardBg: '#06090F', accent: '#FFD700', text: '#FFE566' },
  { min: 75, tier: 'elite',  label: 'ÉLITE',  cardBg: '#120520', accent: '#BF5AF2', text: '#D88EFF' },
  { min: 65, tier: 'gold',   label: 'OR',     cardBg: '#161200', accent: '#D4AF37', text: '#F5D060' },
  { min: 50, tier: 'silver', label: 'ARGENT', cardBg: '#141820', accent: '#8AAABB', text: '#B0CDD8' },
  { min:  0, tier: 'bronze', label: 'BRONZE', cardBg: '#160C04', accent: '#B07040', text: '#D49060' },
];

export function computeFitnessCard(
  sessions30: number, volume30: number, streakWeeks: number, sessions7: number
): FitnessCard {
  const reg = scoreReg(sessions30);
  const vol = scoreVol(volume30);
  const con = scoreCon(streakWeeks);
  const frq = scoreFrq(sessions7);
  const eff = scoreEff(sessions30 > 0 ? volume30 / sessions30 : 0);

  const ovr = clamp(reg * 0.25 + vol * 0.20 + con * 0.20 + frq * 0.20 + eff * 0.15);

  const t = TIERS.find((x) => ovr >= x.min) ?? TIERS[TIERS.length - 1];

  return {
    ovr,
    tier: t.tier,
    tierLabel: t.label,
    cardBg: t.cardBg,
    accent: t.accent,
    textOnCard: t.text,
    attributes: [
      { key: 'reg', label: 'RÉG', score: reg },
      { key: 'vol', label: 'VOL', score: vol },
      { key: 'con', label: 'CON', score: con },
      { key: 'frq', label: 'FRQ', score: frq },
      { key: 'eff', label: 'EFF', score: eff },
    ],
  };
}
