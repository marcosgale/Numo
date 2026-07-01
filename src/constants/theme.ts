import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export const LightColors = {
  primary: '#1DB87A',
  primaryLight: '#E8F8F2',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceDark: '#1C3A30',
  textPrimary: '#1A1A1A',
  textSecondary: '#8E8E93',
  textMuted: '#C7C7CC',
  positive: '#1DB87A',
  negative: '#FF453A',
  warning: '#FF9500',
  border: '#E5E5EA',
  food: '#FFF0E0',
  transport: '#E0F0FF',
  subscriptions: '#F0E0FF',
  health: '#FFE0F0',
  travel: '#E0FFF5',
  income: '#E0FFE8',
};

export const DarkColors = {
  primary: '#1DB87A',
  primaryLight: '#1DB87A22',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceDark: '#0D2820',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#48484A',
  positive: '#30D158',
  negative: '#FF453A',
  warning: '#FF9F0A',
  border: '#38383A',
  food: '#3A2800',
  transport: '#001A3A',
  subscriptions: '#28003A',
  health: '#3A0014',
  travel: '#003A25',
  income: '#003A0F',
};

// Colors estático (light) para los casos que no pueden usar hook (navigation, AddButton)
export const Colors = LightColors;

export const useColors = () => {
  const context = useContext(ThemeContext);
  return context?.isDark ? DarkColors : LightColors;
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 24,
  xxl: 36,
};
