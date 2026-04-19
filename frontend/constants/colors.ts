export const colors = {
  bg: {
    base:    '#0A0B0F',
    surface: '#12151C',
    raised:  '#1A1E29',
    overlay: 'rgba(18, 21, 28, 0.85)',
  },
  brand: {
    from: '#6C63FF',
    via:  '#A855F7',
    to:   '#EC4899',
  },
  accent: {
    primary: '#6C63FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger:  '#EF4444',
    info:    '#38BDF8',
  },
  text: {
    primary:   '#F8FAFC',
    secondary: '#94A3B8',
    muted:     '#475569',
  },
  border: {
    subtle:  'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    strong:  'rgba(255, 255, 255, 0.18)',
  },
} as const;

export function getScoreColor(score: number): string {
  if (score >= 80) return colors.accent.success;
  if (score >= 50) return colors.accent.warning;
  return colors.accent.danger;
}

export function getGrade(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs Work';
}
