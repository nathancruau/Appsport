// Epley formula: estimates 1-rep max from weight and reps
export function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function calculateVolume(
  sets: { reps: number | null; weight: number | null; completed: boolean; isWarmup: boolean }[]
): number {
  return sets
    .filter((s) => s.completed && !s.isWarmup && s.reps && s.weight)
    .reduce((sum, s) => sum + s.reps! * s.weight!, 0);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatWeight(w: number): string {
  return w % 1 === 0 ? `${w}` : `${w.toFixed(1)}`;
}

export function muscleGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    chest: 'Pectoraux',
    back: 'Dos',
    legs: 'Jambes',
    shoulders: 'Épaules',
    arms: 'Bras',
    core: 'Abdos',
    cardio: 'Cardio',
    other: 'Autre',
  };
  return labels[group] ?? group;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
