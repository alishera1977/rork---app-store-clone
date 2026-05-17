export type AppThemeMode = 'dark' | 'light';

export const darkColors = {
  bg: '#0C0E12',
  bgCard: '#161920',
  bgCardElevated: '#1E222B',
  bgInput: '#1A1E27',
  border: '#262B36',
  borderLight: '#2F3542',

  primary: '#D92D20',
  primaryDark: '#B42318',
  primaryLight: '#F04438',
  primaryBg: 'rgba(217, 45, 32, 0.1)',

  accent: '#3B82F6',
  accentBg: 'rgba(59, 130, 246, 0.1)',

  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.1)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  warning: '#F59E0B',

  text: '#F0F1F3',
  textSecondary: '#8B92A0',
  textTertiary: '#5A6173',
  textInverse: '#0C0E12',

  copper: '#D4764E',
  aluminum: '#A8B4C0',
  brass: '#D4A843',
  steel: '#6B7B8D',
  lead: '#7A7E85',
  zinc: '#B0BEC5',
  stainless: '#CFD8DC',
  battery: '#4CAF50',
  nickel: '#8E9EAB',
  nichrome: '#9E8E7E',
  magnesium: '#C5CAD0',
  radiator: '#B87333',
};

export const lightColors = {
  ...darkColors,
  bg: '#F6F7F9',
  bgCard: '#FFFFFF',
  bgCardElevated: '#EEF1F5',
  bgInput: '#FFFFFF',
  border: '#DFE3EA',
  borderLight: '#CBD2DD',
  primaryBg: 'rgba(217, 45, 32, 0.09)',
  accentBg: 'rgba(59, 130, 246, 0.09)',
  successBg: 'rgba(34, 197, 94, 0.09)',
  dangerBg: 'rgba(239, 68, 68, 0.09)',
  text: '#111318',
  textSecondary: '#4D5565',
  textTertiary: '#7A8394',
  textInverse: '#FFFFFF',
};

export type AppColors = typeof darkColors;

const Colors: AppColors = darkColors;

export default Colors;
