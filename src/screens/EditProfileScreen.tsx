import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
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
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const lastNameRef = useRef<TextInput>(null);

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
    Keyboard.dismiss();
    if (!firstName.trim()) {
      Alert.alert(t.common.error, t.editProfile.errors.noName);
      return;
    }
    if (!lastName.trim()) {
      Alert.alert(t.common.error, t.editProfile.errors.noLastName);
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
      Alert.alert(t.common.error, error.message);
    } else {
      Alert.alert(t.editProfile.success, '', [
        { text: t.common.ok, onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (fetching) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.editProfile.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* NOMBRE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.editProfile.firstName}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.editProfile.firstNamePlaceholder}
              placeholderTextColor={Colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* APELLIDO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.editProfile.lastName}</Text>
            <TextInput
              ref={lastNameRef}
              style={styles.input}
              placeholder={t.editProfile.lastNamePlaceholder}
              placeholderTextColor={Colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* MONEDA BASE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.editProfile.baseCurrency}</Text>
            <Text style={styles.sectionHint}>{t.editProfile.currencyHint}</Text>
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
              {loading ? t.editProfile.saving : t.editProfile.save}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
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
