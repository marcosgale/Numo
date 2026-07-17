import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, ScrollView, Switch, Platform, KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'Fr' },
  { code: 'JPY', symbol: '¥' },
];

const getCurrencySymbol = (code: string) => {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
};

type Member = {
  id: string;
  user_id: string | null;
  display_name: string;
  is_claimed: boolean;
};

type ExpenseSplit = {
  memberId: string;
  name: string;
  amount: number;
  is_paid: boolean;
};

export default function AddGroupExpenseScreen({ route, navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const { groupId, members: rawMembers, expense, groupCurrency } = route.params;

  const members: Member[] = rawMembers.map((m: any) => ({
    id: m.id,
    user_id: m.user_id ?? null,
    display_name: m.display_name || '',
    is_claimed: m.is_claimed ?? true,
  }));

  const isEditMode = !!expense;
  const baseGroupCurrency: string = groupCurrency || 'EUR';

  const todayISO = new Date().toISOString().split('T')[0];

  const isoToDisplay = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const displayToISO = (display: string) => {
    const parts = display.split('/');
    if (parts.length !== 3) return todayISO;
    const [d, m, y] = parts;
    if (!d || !m || !y || y.length !== 4) return todayISO;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const formatDateInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 8);
    let result = digits;
    if (digits.length > 2) result = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) result = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    return result;
  };

  const [description, setDescription] = useState(isEditMode ? expense.description : '');
  const [amount, setAmount] = useState(isEditMode ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(
    isEditMode ? (expense.currency || baseGroupCurrency) : baseGroupCurrency
  );
  const [baseAmount, setBaseAmount] = useState<number | null>(
    isEditMode ? Number(expense.base_amount ?? expense.amount) : null
  );
  const [converting, setConverting] = useState(false);
  const [paidBy, setPaidBy] = useState(isEditMode ? expense.paid_by_member_id : '');
  const [dateDisplay, setDateDisplay] = useState(
    isEditMode ? isoToDisplay(expense.date) : isoToDisplay(todayISO)
  );
  const [splitEqually, setSplitEqually] = useState(true);
  const [customSplits, setCustomSplits] = useState<{ [memberId: string]: string }>({});
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members.map(m => m.id));
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        if (!isEditMode) {
          const myMember = members.find(m => m.user_id === user.id);
          if (myMember) setPaidBy(myMember.id);
        }
      }
    };
    init();

    if (isEditMode && expense.splits?.length > 0) {
      const amounts = expense.splits.map((s: ExpenseSplit) => s.amount);
      const allEqual = amounts.length >= 1 &&
        amounts.every((a: number) => Math.abs(a - amounts[0]) < 0.02);

      if (!allEqual) {
        setSplitEqually(false);
        const custom: { [id: string]: string } = {};
        expense.splits.forEach((s: ExpenseSplit) => { custom[s.memberId] = String(s.amount); });
        setCustomSplits(custom);
      }
      setSelectedMembers(expense.splits.map((s: ExpenseSplit) => s.memberId));
    }
  }, []);

  useEffect(() => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setBaseAmount(null);
      return;
    }

    if (currency === baseGroupCurrency) {
      setBaseAmount(parsedAmount);
      return;
    }

    const timer = setTimeout(async () => {
      setConverting(true);
      try {
        const res = await fetch(
          `https://api.frankfurter.app/latest?amount=${parsedAmount}&from=${currency}&to=${baseGroupCurrency}`
        );
        const data = await res.json();
        const converted = data.rates?.[baseGroupCurrency];
        if (converted != null) {
          setBaseAmount(Math.round(converted * 100) / 100);
        } else {
          setBaseAmount(parsedAmount);
        }
      } catch {
        setBaseAmount(parsedAmount);
      } finally {
        setConverting(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, currency, baseGroupCurrency]);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount;
    if (parts[1]?.length > 2) return amount;
    return cleaned;
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getEqualSplit = () => {
    if (!amount || selectedMembers.length === 0) return 0;
    return Math.round((parseFloat(amount) / selectedMembers.length) * 100) / 100;
  };

  const formatMoney = (value: number) =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getMemberDisplayName = (member: Member) => {
    if (member.user_id === currentUserId) return t.groupDetail.you;
    return member.display_name;
  };

  const buildSplits = (expenseId: string, totalAmount: number) => {
    const n = selectedMembers.length;
    if (n === 0) return [];
    if (!splitEqually) {
      return selectedMembers.map(memberId => ({
        group_expense_id: expenseId,
        member_id: memberId,
        amount: parseFloat(customSplits[memberId] || '0'),
        is_paid: memberId === paidBy,
      }));
    }
    // Distribute remainder so splits always sum exactly to totalAmount
    const totalCents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(totalCents / n);
    const extraCents = totalCents - baseCents * n;
    return selectedMembers.map((memberId, index) => ({
      group_expense_id: expenseId,
      member_id: memberId,
      amount: (baseCents + (index < extraCents ? 1 : 0)) / 100,
      is_paid: memberId === paidBy,
    }));
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.common.error, t.addGroupExpense.errors.invalidAmount);
      return;
    }
    if (!description.trim()) {
      setTitleError(true);
      return;
    }
    if (!paidBy) {
      Alert.alert(t.common.error, t.addGroupExpense.errors.noPayer);
      return;
    }
    if (selectedMembers.length < 1) {
      Alert.alert(t.common.error, t.addGroupExpense.errors.minParticipants);
      return;
    }
    if (!splitEqually) {
      const total = selectedMembers.reduce((sum, id) => sum + (parseFloat(customSplits[id] || '0')), 0);
      const diff = Math.abs(total - parseFloat(amount));
      if (diff > 0.02) {
        Alert.alert(t.common.error, t.addGroupExpense.errors.splitMismatch(diff.toFixed(2)));
        return;
      }
    }

    setLoading(true);
    Keyboard.dismiss();

    const dateISO = displayToISO(dateDisplay);
    const parsedAmount = parseFloat(amount);
    const finalBaseAmount = baseAmount ?? parsedAmount;

    // Resolve payer's user_id for backward compat with any DB triggers that read paid_by
    const payerUserId = members.find(m => m.id === paidBy)?.user_id ?? null;

    if (isEditMode) {
      const { error: updateError } = await supabase
        .from('group_expenses')
        .update({
          amount: parsedAmount,
          base_amount: finalBaseAmount,
          description: description.trim(),
          date: dateISO,
          paid_by: payerUserId,
          paid_by_member_id: paidBy,
          currency,
        })
        .eq('id', expense.id);

      if (updateError) {
        setLoading(false);
        Alert.alert(t.common.error, updateError.message);
        return;
      }

      await supabase.from('group_expense_splits').delete().eq('group_expense_id', expense.id);

      const splits = buildSplits(expense.id, parsedAmount);

      const { error: splitError } = await supabase.from('group_expense_splits').insert(splits);
      setLoading(false);
      if (splitError) Alert.alert(t.common.error, splitError.message);
      else navigation.goBack();
    } else {
      const { data: newExpense, error: expenseError } = await supabase
        .from('group_expenses')
        .insert({
          group_id: groupId,
          paid_by: payerUserId,
          paid_by_member_id: paidBy,
          amount: parsedAmount,
          base_amount: finalBaseAmount,
          description: description.trim(),
          date: dateISO,
          currency,
        })
        .select('id')
        .single();

      if (expenseError || !newExpense) {
        setLoading(false);
        Alert.alert(t.common.error, expenseError?.message || t.common.error);
        return;
      }

      const splits = buildSplits(newExpense.id, parsedAmount);

      const { error: splitError } = await supabase.from('group_expense_splits').insert(splits);
      setLoading(false);
      if (splitError) Alert.alert(t.common.error, splitError.message);
      else navigation.goBack();
    }
  };

  const currencySymbol = getCurrencySymbol(currency);
  const groupSymbol = getCurrencySymbol(baseGroupCurrency);
  const showConversion = currency !== baseGroupCurrency;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? t.addGroupExpense.editTitle : t.addGroupExpense.title}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* TÍTULO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t.addGroupExpense.descriptionLabel} <Text style={{ color: Colors.negative }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, titleError && styles.inputError]}
              placeholder={t.addGroupExpense.descriptionPlaceholder}
              placeholderTextColor={Colors.textSecondary}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (titleError && text.trim()) setTitleError(false);
              }}
            />
            {titleError && (
              <Text style={styles.errorText}>{t.addGroupExpense.descriptionRequired}</Text>
            )}
          </View>

          {/* IMPORTE + MONEDA */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addGroupExpense.amount}</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={amount}
                onChangeText={(text) => setAmount(formatAmount(text))}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountSymbol}>{currencySymbol}</Text>
            </View>

            {showConversion && (
              <View style={styles.conversionRow}>
                {converting ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : baseAmount != null ? (
                  <Text style={styles.conversionText}>
                    {t.addGroupExpense.conversionNote(formatMoney(baseAmount), groupSymbol)}
                  </Text>
                ) : null}
              </View>
            )}

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
                    <Text style={[styles.currencyChipSymbol, isActive && styles.currencyTextActive]}>
                      {c.symbol}
                    </Text>
                    <Text style={[styles.currencyChipCode, isActive && styles.currencyTextActive]}>
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* QUIÉN HA PAGADO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addGroupExpense.whoPaid}</Text>
            <View style={styles.payerRow}>
              {members.map(m => {
                const isSelected = paidBy === m.id;
                const displayName = getMemberDisplayName(m);
                const initial = m.display_name[0]?.toUpperCase() || '?';
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.payerChip, isSelected && styles.payerChipActive]}
                    onPress={() => setPaidBy(m.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.payerAvatar, isSelected && styles.payerAvatarActive]}>
                      <Text style={[styles.payerInitial, isSelected && styles.payerInitialActive]}>
                        {initial}
                      </Text>
                    </View>
                    <Text style={[styles.payerName, isSelected && styles.payerNameActive]}>
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* FECHA */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addGroupExpense.date}</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.textSecondary}
              value={dateDisplay}
              onChangeText={(text) => setDateDisplay(formatDateInput(text))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* MÉTODO DE DIVISIÓN */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t.addGroupExpense.splitEqually}</Text>
            <Switch
              value={splitEqually}
              onValueChange={setSplitEqually}
              trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
              thumbColor={splitEqually ? Colors.primary : '#f4f3f4'}
            />
          </View>

          {/* PARTICIPANTES */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addGroupExpense.participants}</Text>
            <View style={styles.card}>
              {members.map((m, index) => {
                const isSelected = selectedMembers.includes(m.id);
                const displayName = getMemberDisplayName(m);

                return (
                  <View
                    key={m.id}
                    style={[styles.memberRow, index < members.length - 1 && styles.borderBottom]}
                  >
                    <TouchableOpacity
                      style={styles.memberCheck}
                      onPress={() => toggleMember(m.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.memberName}>{displayName}</Text>
                    </TouchableOpacity>

                    {!splitEqually && isSelected && (
                      <View style={styles.customSplitInput}>
                        <TextInput
                          style={styles.splitInput}
                          placeholder="0.00"
                          placeholderTextColor={Colors.textSecondary}
                          value={customSplits[m.id] || ''}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            setCustomSplits(prev => ({ ...prev, [m.id]: cleaned }));
                          }}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.splitCurrency}>{currencySymbol}</Text>
                      </View>
                    )}

                    {splitEqually && isSelected && amount && parseFloat(amount) > 0 && (
                      <Text style={styles.equalAmount}>
                        {formatMoney(getEqualSplit())}{currencySymbol}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || converting) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading || converting}
          >
            <Text style={styles.buttonText}>
              {loading ? t.addGroupExpense.saving : converting ? t.addGroupExpense.converting : isEditMode ? t.addGroupExpense.update : t.addGroupExpense.save}
            </Text>
          </TouchableOpacity>

          <View style={{ height: Spacing.lg }} />
        </ScrollView>
      </SafeAreaView>
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
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  inputError: { borderWidth: 1.5, borderColor: Colors.negative },
  errorText: { fontSize: FontSize.xs, color: Colors.negative, marginTop: 4, marginLeft: 2 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
  },
  amountSymbol: { fontSize: 28, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.xs },
  conversionRow: {
    height: 24,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  conversionText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  currencyRow: { flexDirection: 'row', gap: Spacing.xs },
  currencyChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 2,
  },
  currencyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyChipSymbol: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  currencyChipCode: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  currencyTextActive: { color: '#fff' },
  payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
    paddingLeft: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  payerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  payerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerAvatarActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  payerInitial: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  payerInitialActive: { color: '#fff' },
  payerName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  payerNameActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberCheck: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  memberName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  equalAmount: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  customSplitInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
  },
  splitInput: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: Spacing.xs,
    width: 70,
    textAlign: 'right',
  },
  splitCurrency: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
