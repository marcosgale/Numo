export type CategoryDefinition = {
  key: string;
  es: string;
  icon: string;
  color: string;
};

// Canonical set of 14 expense categories — single source of truth for the app
export const EXPENSE_CATEGORIES: CategoryDefinition[] = [
  { key: 'vivienda',     es: 'Vivienda',     icon: '🏠', color: '#54A0FF' },
  { key: 'alimentacion', es: 'Alimentación', icon: '🍔', color: '#FF9F43' },
  { key: 'transporte',   es: 'Transporte',   icon: '🚗', color: '#FECA57' },
  { key: 'compras',      es: 'Compras',      icon: '🛒', color: '#FF9FF3' },
  { key: 'ocio',         es: 'Ocio',         icon: '🎉', color: '#5F27CD' },
  { key: 'salud',        es: 'Salud',        icon: '❤️',  color: '#FF6B6B' },
  { key: 'educacion',    es: 'Educación',    icon: '📚', color: '#48DBFB' },
  { key: 'viaje',        es: 'Viajes',       icon: '✈️',  color: '#1DD1A1' },
  { key: 'trabajo',      es: 'Trabajo',      icon: '💼', color: '#576574' },
  { key: 'facturas',     es: 'Facturas',     icon: '💡', color: '#C8D6E5' },
  { key: 'familia',      es: 'Familia',      icon: '👨‍👩‍👧', color: '#FD9644' },
  { key: 'regalos',      es: 'Regalos',      icon: '🎁', color: '#FF453A' },
  { key: 'mascota',      es: 'Mascotas',     icon: '🐶', color: '#A29BFE' },
  { key: 'otros',        es: 'Otros',        icon: '📦', color: '#636E72' },
];

// Maps DB-stored Spanish name (lowercase) → translation key in t.planner.items.
// Includes current canonical names AND legacy names for backward compatibility
// so that old categories already saved in the database still display correctly.
export const CANONICAL_CAT_KEY: Record<string, string> = {
  // Canonical names
  'vivienda': 'vivienda',
  'alimentacion': 'alimentacion',
  'alimentación': 'alimentacion',
  'transporte': 'transporte',
  'compras': 'compras',
  'ocio': 'ocio',
  'salud': 'salud',
  'educacion': 'educacion',
  'educación': 'educacion',
  'viaje': 'viaje',
  'viajes': 'viaje',
  'trabajo': 'trabajo',
  'facturas': 'facturas',
  'familia': 'familia',
  'regalos': 'regalos',
  'mascota': 'mascota',
  'mascotas': 'mascota',
  'otros': 'otros',
  'ahorro': 'ahorro',
  // Legacy names → nearest canonical (existing DB data continues to display correctly)
  'hogar': 'vivienda',
  'restaurantes': 'alimentacion',
  'ropa': 'compras',
  'suscripciones': 'facturas',
  'deporte': 'ocio',
  'tecnologia': 'compras',
  'tecnología': 'compras',
};
