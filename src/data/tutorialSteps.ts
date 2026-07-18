export type SpotlightRegion = {
  yStart: number;  // fraction of window height from top (0–1)
  yEnd: number;
  xStart?: number; // fraction of window width from left (default 0.04)
  xEnd?: number;   // fraction of window width from left (default 0.96)
  radius?: number; // border radius (default 14)
};

export type TutorialStep = {
  id: string;
  tab: 'Inicio' | 'Grupos' | 'Planifica' | 'Perfil' | null;
  spotlight?: SpotlightRegion;
  tooltipPosition: 'top' | 'bottom' | 'center';
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  // 0 – Welcome
  {
    id: 'welcome',
    tab: null,
    tooltipPosition: 'center',
  },
  // 1 – Dashboard overview
  {
    id: 'dashboard_overview',
    tab: 'Inicio',
    tooltipPosition: 'center',
  },
  // 2 – Balance card (top ~10–33% of screen)
  {
    id: 'dashboard_balance',
    tab: 'Inicio',
    spotlight: { yStart: 0.10, yEnd: 0.33 },
    tooltipPosition: 'bottom',
  },
  // 3 – Monthly summary (below balance ~33–50%)
  {
    id: 'dashboard_summary',
    tab: 'Inicio',
    spotlight: { yStart: 0.33, yEnd: 0.52 },
    tooltipPosition: 'bottom',
  },
  // 4 – The + FAB in the centre of the tab bar
  {
    id: 'dashboard_add',
    tab: 'Inicio',
    spotlight: { yStart: 0.87, yEnd: 0.99, xStart: 0.33, xEnd: 0.67, radius: 32 },
    tooltipPosition: 'top',
  },
  // 5 – Plan/Limits overview (navigate to Planifica)
  {
    id: 'plan_overview',
    tab: 'Planifica',
    tooltipPosition: 'center',
  },
  // 6 – The 3 sub-tabs (plan / goals / limits)
  {
    id: 'plan_tabs',
    tab: 'Planifica',
    spotlight: { yStart: 0.06, yEnd: 0.17 },
    tooltipPosition: 'bottom',
  },
  // 7 – Goals feature (centered explanation, content varies by user data)
  {
    id: 'goals',
    tab: 'Planifica',
    tooltipPosition: 'center',
  },
  // 8 – Groups (navigate to Grupos)
  {
    id: 'groups',
    tab: 'Grupos',
    tooltipPosition: 'center',
  },
  // 9 – Profile / settings (navigate to Perfil, spotlight menu card)
  {
    id: 'profile',
    tab: 'Perfil',
    spotlight: { yStart: 0.51, yEnd: 0.73 },
    tooltipPosition: 'top',
  },
  // 10 – Done
  {
    id: 'done',
    tab: 'Perfil',
    tooltipPosition: 'center',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
