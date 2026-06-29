import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

const CURRENCIES = [
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'USD', name: 'Dólar ($)' },
  { code: 'GBP', name: 'Libra (£)' },
  { code: 'CHF', name: 'Franco suizo (Fr)' },
  { code: 'JPY', name: 'Yen (¥)' },
  { code: 'MXN', name: 'Peso mexicano ($)' },
  { code: 'BRL', name: 'Real (R$)' },
  { code: 'ARS', name: 'Peso argentino ($)' },
  { code: 'COP', name: 'Peso colombiano ($)' },
];

export default function EditProfileScreen({ navigation }: any) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, currency')
        .eq('id', user.id)
        .single();

      if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setCurrency(data.currency || 'EUR');
      }
      setFetching(false);
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Error', 'Introduce tu nombre');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Error', 'Introduce tu apellido');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        currency: currency,
      })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('¡Perfil actualizado!', '', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (fetching) return null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editar perfil</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* NOMBRE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor={Colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>

          {/* APELLIDO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Apellido</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu apellido"
              placeholderTextColor={Colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>

          {/* MONEDA BASE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Moneda base</Text>
            <Text style={styles.sectionHint}>Tu saldo y totales se mostrarán en esta moneda</Text>
            <View style={styles.currencyGrid}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.currencyChip,
                    currency === c.code && styles.currencyChipActive,
                  ]}
                  onPress={() => setCurrency(c.code)}
                >
                  <Text style={[
                    styles.currencyCode,
                    currency === c.code && styles.currencyCodeActive,
                  ]}>
                    {c.code}
                  </Text>
                  <Text style={[
                    styles.currencyName,
                    currency === c.code && styles.currencyNameActive,
                  ]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* BOTÓN */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  container: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  sectionHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  currencyGrid: { gap: Spacing.xs },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  currencyChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  currencyCode: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    width: 50,
  },
  currencyCodeActive: { color: Colors.primary },
  currencyName: { fontSize: FontSize.sm, color: Colors.textSecondary },
  currencyNameActive: { color: Colors.primary },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});