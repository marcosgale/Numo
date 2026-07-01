import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut, ChevronRight, User, Tag, Bell, Shield,
  CircleHelp, Sun, Moon, Smartphone
} from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Profile = {
  first_name: string;
  last_name: string;
  birth_date: string;
  currency: string;
};

type ThemePreference = 'system' | 'light' | 'dark';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: any }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Smartphone },
];

export default function ProfileScreen() {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { theme, setTheme } = useTheme();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email || '');
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, birth_date, currency')
          .eq('id', user.id)
          .single();
        if (data) setProfile(data);
      };
      fetchProfile();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => { await supabase.auth.signOut(); },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!profile) return '?';
    return ((profile.first_name?.[0] || '') + (profile.last_name?.[0] || '')).toUpperCase();
  };

  const MENU = [
    { icon: User, label: 'Editar perfil', onPress: () => navigation.navigate('EditProfile') },
    { icon: Tag, label: 'Categorías', onPress: () => navigation.navigate('Categories') },
    { icon: Bell, label: 'Notificaciones', onPress: () => navigation.navigate('Notifications') },
    { icon: Shield, label: 'Privacidad y seguridad', onPress: () => navigation.navigate('Privacy') },
    { icon: CircleHelp, label: 'Ayuda', onPress: () => navigation.navigate('Help') },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Perfil</Text>

        {/* AVATAR */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.profileName}>
            {profile ? `${profile.first_name} ${profile.last_name}` : '—'}
          </Text>
          <Text style={styles.profileEmail}>{email}</Text>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>{profile?.currency || 'EUR'}</Text>
          </View>
        </View>

        {/* DARK MODE */}
        <Text style={styles.sectionLabel}>Apariencia</Text>
        <View style={styles.themeCard}>
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const isActive = theme === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.themeOption, isActive && styles.themeOptionActive]}
                onPress={() => setTheme(value)}
                activeOpacity={0.7}
              >
                <Icon
                  size={18}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                  style={{ marginBottom: 4 }}
                />
                <Text style={[styles.themeLabel, isActive && styles.themeLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* MENÚ */}
        <Text style={styles.sectionLabel}>Ajustes</Text>
        <View style={styles.menuCard}>
          {MENU.map(({ icon: Icon, label, onPress }, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconWrap}>
                <Icon size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.menuLabel}>{label}</Text>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={Colors.negative} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Numo v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },

  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  profileName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  currencyBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  currencyBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  themeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  themeOptionActive: { backgroundColor: Colors.primary + '18' },
  themeLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  themeLabelActive: { color: Colors.primary },

  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  menuLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.negative + '12',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.negative },
  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted },
});
