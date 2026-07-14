import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

export default function PrivacyScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert(t.common.error, t.privacy.errors.shortPassword);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t.common.error, t.privacy.errors.mismatch);
      return;
    }

    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t.privacy.success, t.privacy.successMsg);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t.privacy.deleteTitle,
      t.privacy.deleteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setDeletingAccount(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingAccount(false); return; }

    await supabase.from('group_expenses').delete().eq('paid_by', user.id);
    await supabase.from('group_members').delete().eq('user_id', user.id);
    await supabase.from('limits').delete().eq('user_id', user.id);
    await supabase.from('goals').delete().eq('user_id', user.id);
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);

    const { error } = await supabase.rpc('delete_user');
    if (error) {
      Alert.alert(t.common.error, t.privacy.deleteError + error.message);
      setDeletingAccount(false);
      return;
    }

    await supabase.auth.signOut();
    setDeletingAccount(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.privacy.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>{t.privacy.changePassword}</Text>
        <View style={styles.card}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={t.privacy.newPassword}
              placeholderTextColor={Colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
              {showNew
                ? <EyeOff size={18} color={Colors.textSecondary} />
                : <Eye size={18} color={Colors.textSecondary} />
              }
            </TouchableOpacity>
          </View>

          <View style={[styles.inputWrapper, styles.inputBorder]}>
            <TextInput
              style={styles.input}
              placeholder={t.privacy.confirmPassword}
              placeholderTextColor={Colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
              {showConfirm
                ? <EyeOff size={18} color={Colors.textSecondary} />
                : <Eye size={18} color={Colors.textSecondary} />
              }
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, savingPwd && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={savingPwd}
        >
          {savingPwd
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.buttonText}>{t.privacy.updatePassword}</Text>
          }
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>{t.privacy.dangerZone}</Text>
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>{t.privacy.deleteAccount}</Text>
          <Text style={styles.dangerDesc}>{t.privacy.deleteAccountDesc}</Text>
          <TouchableOpacity
            style={[styles.deleteButton, deletingAccount && styles.buttonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator size="small" color={Colors.negative} />
              : <Text style={styles.deleteButtonText}>{t.privacy.deleteAccountBtn}</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  inputBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: 4 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  dangerCard: {
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.negative + '30',
  },
  dangerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.negative, marginBottom: Spacing.sm },
  dangerDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  deleteButton: {
    borderWidth: 1.5,
    borderColor: Colors.negative,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  deleteButtonText: { color: Colors.negative, fontSize: FontSize.md, fontWeight: '700' },
});
