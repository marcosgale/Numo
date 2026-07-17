import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Share, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Copy, Plus, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const EMOJIS = ['👥', '🏠', '✈️', '🍽️', '🎉', '🏋️', '🎓', '💼', '🎮', '🏖️', '🚗', '❤️', '🎵', '⚽', '🛒', '🍕'];

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dólar' },
  { code: 'GBP', symbol: '£', name: 'Libra' },
  { code: 'CHF', symbol: 'Fr', name: 'Franco' },
  { code: 'JPY', symbol: '¥', name: 'Yen' },
];

const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function CreateGroupScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [currency, setCurrency] = useState('EUR');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [memberNames, setMemberNames] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdGroupName, setCreatedGroupName] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const updateMemberName = (index: number, value: string) => {
    setMemberNames(prev => prev.map((n, i) => (i === index ? value : n)));
  };

  const addMemberSlot = () => {
    setMemberNames(prev => [...prev, '']);
  };

  const removeMemberSlot = (index: number) => {
    setMemberNames(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t.common.error, t.createGroup.errors.noName);
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    const creatorName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : 'Creator';

    const inviteCode = generateCode();

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        emoji,
        currency,
        created_by: user.id,
        invite_code: inviteCode,
      })
      .select('id')
      .single();

    if (groupError) {
      setLoading(false);
      Alert.alert(t.common.error, groupError.message);
      return;
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        display_name: creatorName,
        is_claimed: true,
      });

    if (memberError) {
      setLoading(false);
      Alert.alert(t.common.error, memberError.message);
      return;
    }

    const validNames = memberNames.map(n => n.trim()).filter(Boolean);
    if (validNames.length > 0) {
      const { error: placeholderError } = await supabase
        .from('group_members')
        .insert(
          validNames.map(displayName => ({
            group_id: group.id,
            user_id: null,
            display_name: displayName,
            is_claimed: false,
          }))
        );
      if (placeholderError) {
        setLoading(false);
        Alert.alert(t.common.error, placeholderError.message);
        return;
      }
    }

    setLoading(false);
    setCreatedGroupName(name.trim());
    setCreatedCode(inviteCode);
  };

  const handleCopyCode = async () => {
    if (createdCode) {
      await Clipboard.setStringAsync(createdCode);
      Alert.alert(t.common.copied, t.createGroup.copiedMsg);
    }
  };

  const handleShare = async () => {
    if (createdCode) {
      await Share.share({
        message: t.createGroup.shareMsg(createdGroupName, createdCode),
      });
    }
  };

  if (createdCode) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>{t.createGroup.successTitle}</Text>
          <Text style={styles.successSub}>{t.createGroup.successSub}</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t.createGroup.inviteCode}</Text>
            <Text style={styles.codeText}>{createdCode}</Text>
            <View style={styles.codeButtons}>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
                <Copy size={16} color={Colors.primary} />
                <Text style={styles.codeBtnText}>{t.common.copy}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.codeBtn, styles.codeBtnShare]} onPress={handleShare}>
                <Text style={styles.codeBtnShareText}>{t.common.share}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>{t.createGroup.goToGroup}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronLeft size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t.createGroup.title}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* EMOJI */}
            <View style={styles.emojiSection}>
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => setShowEmojiPicker(v => !v)}
                activeOpacity={0.7}
              >
                <View style={styles.emojiCircle}>
                  <Text style={styles.emojiLarge}>{emoji}</Text>
                </View>
                <Text style={styles.emojiHint}>
                  {showEmojiPicker ? t.createGroup.closeIcon : t.createGroup.changeIcon}
                </Text>
              </TouchableOpacity>

              {showEmojiPicker && (
                <View style={styles.emojiGrid}>
                  {EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
                      onPress={() => { setEmoji(e); setShowEmojiPicker(false); }}
                    >
                      <Text style={styles.emojiChipText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* NOMBRE */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.createGroup.groupName}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.createGroup.groupNamePlaceholder}
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* MONEDA */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.createGroup.groupCurrency}</Text>
              <View style={styles.currencyRow}>
                {CURRENCIES.map(c => {
                  const isActive = currency === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      style={[styles.currencyChip, isActive && styles.currencyChipActive]}
                      onPress={() => setCurrency(c.code)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.currencySymbol, isActive && styles.currencyTextActive]}>
                        {c.symbol}
                      </Text>
                      <Text style={[styles.currencyCode, isActive && styles.currencyTextActive]}>
                        {c.code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* INTEGRANTES */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.createGroup.addMembers}</Text>
              <Text style={styles.membersHint}>{t.createGroup.membersHint}</Text>

              {/* Creator row (fixed) */}
              <View style={styles.memberSlot}>
                <View style={styles.memberSlotAvatar}>
                  <Text style={styles.memberSlotAvatarText}>★</Text>
                </View>
                <Text style={styles.youLabel}>{t.createGroup.youLabel}</Text>
              </View>

              {/* Placeholder member rows */}
              {memberNames.map((memberName, index) => (
                <View key={index} style={styles.memberSlot}>
                  <View style={styles.memberSlotAvatar}>
                    <Text style={styles.memberSlotAvatarText}>
                      {memberName.trim() ? memberName.trim()[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                  <TextInput
                    ref={ref => { inputRefs.current[index] = ref; }}
                    style={styles.memberInput}
                    placeholder={t.createGroup.memberNamePlaceholder}
                    placeholderTextColor={Colors.textSecondary}
                    value={memberName}
                    onChangeText={v => updateMemberName(index, v)}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      if (index === memberNames.length - 1) addMemberSlot();
                      else inputRefs.current[index + 1]?.focus();
                    }}
                  />
                  {memberNames.length > 1 && (
                    <TouchableOpacity onPress={() => removeMemberSlot(index)} style={styles.removeBtn}>
                      <X size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addMemberBtn} onPress={addMemberSlot}>
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addMemberText}>{t.createGroup.addMember}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t.createGroup.creating : t.createGroup.create}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  emojiSection: { alignItems: 'center', marginBottom: Spacing.lg },
  emojiButton: { alignItems: 'center', marginBottom: Spacing.sm },
  emojiCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: Spacing.xs,
  },
  emojiLarge: { fontSize: 44 },
  emojiHint: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  emojiChipText: { fontSize: 24 },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  currencyRow: { flexDirection: 'row', gap: Spacing.sm },
  currencyChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 2,
  },
  currencyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  currencySymbol: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  currencyCode: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  currencyTextActive: { color: '#fff' },
  membersHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  memberSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  memberSlotAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSlotAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  youLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary, fontStyle: 'italic' },
  memberInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  removeBtn: { padding: 4 },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
  },
  addMemberText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  successEmoji: { fontSize: 64, marginBottom: Spacing.md },
  successTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  successSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  codeText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  codeButtons: { flexDirection: 'row', gap: Spacing.sm },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  codeBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  codeBtnShare: { backgroundColor: Colors.primary },
  codeBtnShareText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  doneButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
