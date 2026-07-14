import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

export default function RegisterScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const validateAge = (dateString: string): boolean => {
    const parts = dateString.split('/');
    if (parts.length !== 3) return false;
    const birth = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(birth.getTime())) return false;
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    const exactAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    return exactAge >= 16;
  };

  const formatBirthDate = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  };

  const translateAuthError = (msg: string): string => {
    if (msg.includes('already registered') || msg.includes('already been registered')) return t.register.errors.alreadyRegistered;
    if (msg.includes('invalid email') || msg.includes('Invalid email')) return t.register.errors.invalidEmail;
    if (msg.includes('Password should be')) return t.register.errors.shortPassword;
    if (msg.includes('rate limit') || msg.includes('too many')) return t.register.errors.rateLimit;
    if (msg.includes('network') || msg.includes('fetch')) return t.register.errors.networkError;
    return msg;
  };

  const handleRegister = async () => {
    if (!firstName.trim()) { Alert.alert(t.common.error, t.register.errors.noName); return; }
    if (!lastName.trim()) { Alert.alert(t.common.error, t.register.errors.noLastName); return; }
    if (!validateAge(birthDate)) { Alert.alert(t.common.error, t.register.errors.ageError); return; }
    if (!email.trim()) { Alert.alert(t.common.error, t.register.errors.noEmail); return; }
    if (password.length < 6) { Alert.alert(t.common.error, t.register.errors.shortPassword); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), birth_date: birthDate } },
    });
    setLoading(false);

    if (error) {
      Alert.alert(t.register.errors.signUpError, translateAuthError(error.message));
      return;
    }

    if (!data.session) {
      Alert.alert(
        t.register.checkEmail,
        t.register.checkEmailMsg(email),
        [{ text: t.register.understood, onPress: () => navigation.goBack() }]
      );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t.register.title}</Text>
          <Text style={styles.subtitle}>{t.register.subtitle}</Text>

          <TextInput style={styles.input} placeholder={t.register.firstName}
            placeholderTextColor={Colors.textSecondary} value={firstName}
            onChangeText={setFirstName} autoCapitalize="words" />

          <TextInput style={styles.input} placeholder={t.register.lastName}
            placeholderTextColor={Colors.textSecondary} value={lastName}
            onChangeText={setLastName} autoCapitalize="words" />

          <TextInput style={styles.input} placeholder={t.register.birthDate}
            placeholderTextColor={Colors.textSecondary} value={birthDate}
            onChangeText={(text) => setBirthDate(formatBirthDate(text))}
            keyboardType="numeric" maxLength={10} />

          <TextInput style={styles.input} placeholder={t.register.email}
            placeholderTextColor={Colors.textSecondary} value={email}
            onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <TextInput style={styles.input} placeholder={t.register.password}
            placeholderTextColor={Colors.textSecondary} value={password}
            onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? t.register.loading : t.register.submit}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>
              {t.register.hasAccount} <Text style={styles.linkBold}>{t.register.loginLink}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  linkButton: { alignItems: 'center', marginTop: Spacing.lg, paddingBottom: Spacing.lg },
  linkText: { fontSize: FontSize.md, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});
