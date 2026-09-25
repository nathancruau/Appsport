export interface FitnessLevel {
  id: string;
  label: string;
  emoji: string;
  minSessions: number;
  color: string;
}

export const FITNESS_LEVELS: FitnessLevel[] = [
  { id: 'inactif',  label: 'Inactif',  emoji: '💤', minSessions: 0,  color: '#636366' },
  { id: 'debutant', label: 'Débutant', emoji: '🌱', minSessions: 2,  color: '#0A84FF' },
  { id: 'regulier', label: 'Régulier', emoji: '🏃', minSessions: 5,  color: '#FF9F0A' },
  { id: 'assidu',   label: 'Assidu',   emoji: '💪', minSessions: 9,  color: '#FFD60A' },
  { id: 'elite',    label: 'Elite',    emoji: '⚡', minSessions: 13, color: '#BF5AF2' },
];

export function computeFitnessLevel(sessionsLast30Days: number): FitnessLevel {
  return (
    [...FITNESS_LEVELS].reverse().find((l) => sessionsLast30Days >= l.minSessions) ??
    FITNESS_LEVELS[0]
  );
}
