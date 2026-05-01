import { useColorScheme } from 'react-native';

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const darkColors = {
  bg: {
    base:    '#0A0B0F',
    surface: '#12151C',
    raised:  '#1A1E29',
    overlay: 'rgba(18, 21, 28, 0.85)',
  },
  brand: { from: '#6C63FF', via: '#A855F7', to: '#EC4899' },
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
  gradient: {
    bg: ['#0A0B0F', '#0D1018', '#0A0B0F'] as const,
  },
} as const;

// ─── Light theme ──────────────────────────────────────────────────────────────

export const lightColors = {
  bg: {
    base:    '#F8FAFC',
    surface: '#FFFFFF',
    raised:  '#F1F5F9',
    overlay: 'rgba(248, 250, 252, 0.92)',
  },
  brand: { from: '#6C63FF', via: '#A855F7', to: '#EC4899' },
  accent: {
    primary: '#6C63FF',
    success: '#059669',
    warning: '#D97706',
    danger:  '#DC2626',
    info:    '#0284C7',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#475569',
    muted:     '#94A3B8',
  },
  border: {
    subtle:  'rgba(0, 0, 0, 0.05)',
    default: 'rgba(0, 0, 0, 0.09)',
    strong:  'rgba(0, 0, 0, 0.16)',
  },
  gradient: {
    bg: ['#F8FAFC', '#EFF6FF', '#F8FAFC'] as const,
  },
} as const;

export type AppColors = typeof darkColors;

// ─── Default export (dark) — keeps all untouched screens working ──────────────
export const colors = darkColors;

// ─── Hook — use this in screens that support theming ─────────────────────────
export function useColors(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 80) return darkColors.accent.success;
  if (score >= 50) return darkColors.accent.warning;
  return darkColors.accent.danger;
}

export function getGrade(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs Work';
}
