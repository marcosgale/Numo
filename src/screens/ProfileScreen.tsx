import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, ChevronRight, User, CreditCard, Bell, Shield, CircleHelp } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Profile = {
  first_name: string;
  last_name: string;
  birth_date: string;
  currency: string;
};

export default function ProfileScreen() {
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
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!profile) return '?';
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase();
  };

  const formatBirthDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Perfil</Text>

        {/* AVATAR + NOMBRE */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.profileName}>
            {profile?.first_name} {profile?.last_name}
          </Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>

        {/* INFO PERSONAL */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Información personal</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre</Text>
              <Text style={styles.infoValue}>{profile?.first_name} {profile?.last_name}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Fecha de nacimiento</Text>
              <Text style={styles.infoValue}>
                {profile?.birth_date ? formatBirthDate(profile.birth_date) : 'No definida'}
              </Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Moneda base</Text>
              <Text style={styles.infoValue}>{profile?.currency || 'EUR'}</Text>
            </View>
          </View>
        </View>

        {/* OPCIONES */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ajustes</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('EditProfile')}>
              <User size={20} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Editar perfil</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowBorder]} onPress={() => Alert.alert('Próximamente', 'Podrás gestionar tus categorías aquí')}>
              <CreditCard size={20} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Categorías</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowBorder]} onPress={() => Alert.alert('Próximamente', 'Podrás configurar notificaciones aquí')}>
              <Bell size={20} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Notificaciones</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowBorder]} onPress={() => Alert.alert('Próximamente', 'Privacidad y seguridad')}>
              <Shield size={20} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Privacidad y seguridad</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowBorder]} onPress={() => Alert.alert('Próximamente', 'Centro de ayuda')}>
              <CircleHelp size={20} color={Colors.textSecondary} />
              <Text style={styles.menuText}>Ayuda</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Colors.negative} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Numo v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  profileEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  menuText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, marginLeft: Spacing.sm },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.negative, marginLeft: Spacing.sm },
  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm },
});