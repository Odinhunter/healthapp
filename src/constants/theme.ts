export const colors = {
  primary: '#0F6E56',
  primaryLight: '#E1F5EE',
  background: '#FAFAF9',
  surface: '#FFFFFF',
  border: '#E8E6E1',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6966',
  textTertiary: '#9C9A92',

  success: '#1D9E75',
  warning: '#BA7517',
  danger: '#E24B4A',
  critical: '#A32D2D',
} as const;

export const typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const theme = { colors, typography, spacing, radius } as const;

export type Theme = typeof theme;
