import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,           // dónde guardar la sesión
      autoRefreshToken: true,           // renovar token automáticamente
      persistSession: true,             // mantener sesión entre cierres
      detectSessionInUrl: false,        // no aplica en móvil
    },
  }
);