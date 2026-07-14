import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type ExistingLimit = {
  id: string;
  category_id: string;
  amount: number;
  period: string;
};

type Period = 'monthly' | 'weekly' | 'daily';

export default function PlannerScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const [period, setPeriod] = useState<Period>('monthly');
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [allLimits, setAllLimits] = useState<ExistingLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: cats }, { data: limits }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('type', 'expense')
        .eq('user_id', user.id)
        .neq('name', 'Ahorro')
        .order('name'),
      supabase
        .from('limits')
        .select('id, category_id, amount, period')
        .eq('user_id', user.id),
    ]);

    const catList = cats || [];
    const limitList = (limits || []) as ExistingLimit[];

    setCategories(catList);
    setAllLimits(limitList);

    // Pre-fill amounts from existing monthly limits
    const initial: Record<string, string> = {};
    for (const l of limitList) {
      if (l.period === 'monthly') {
        initial[l.category_id] = String(l.amount);
      }
    }
    setAmounts(initial);
    setLoading(false);
  };

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    const newAmounts: Record<string, string> = {};
    for (const l of allLimits) {
      if (l.period === next) {
        newAmounts[l.category_id] = String(l.amount);
      }
    }
    setAmounts(newAmounts);
  };

  const formatAmount = (text: string, prev: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return prev;
    if (parts[1]?.length > 2) return prev;
    return cleaned;
  };

  const formatMoney = (value: number) =>
    value.toLocaleString(t.dashboard.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalBudget = categories.reduce((sum, c) => {
    const v = parseFloat(amounts[c.id] || '0');
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const filledCount = categories.filter(c => {
    const v = parseFloat(amounts[c.id] || '0');
    return !isNaN(v) && v > 0;
  }).length;

  const hasExisting = (catId: string) =>
    allLimits.some(l => l.category_id === catId && l.period === period);

  const handleSave = async () => {
    const toSave = categories.filter(c => {
      const v = parseFloat(amounts[c.id] || '0');
      return !isNaN(v) && v > 0;
    });

    if (toSave.length === 0) {
      Alert.alert(t.common.error, t.planner.noAmountAlert);
      return;
    }

    const toReplace = allLimits.filter(
      l => l.period === period && toSave.some(c => c.id === l.category_id)
    );

    const doSave = async () => {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }

      if (toReplace.length > 0) {
        await supabase.from('limits').delete().in('id', toReplace.map(l => l.id));
      }

      const { error } = await supabase.from('limits').insert(
        toSave.map(c => ({
          user_id: user.id,
          category_id: c.id,
          amount: parseFloat(amounts[c.id]),
          period,
        }))
      );

      setSaving(false);

      if (error) {
        Alert.alert(t.common.error, error.message);
      } else {
        Alert.alert(t.planner.successTitle, t.planner.successMsg(toSave.length), [
          { text: t.common.ok, onPress: () => navigation.goBack() },
        ]);
      }
    };

    if (toReplace.length > 0) {
      Alert.alert(t.planner.replaceTitle, t.planner.replaceMsg(toReplace.length), [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.planner.replace, onPress: doSave },
      ]);
    } else {
      doSave();
    }
  };

  const PERIODS: { key: Period; label: string; desc: string }[] = [
    { key: 'monthly', label: t.planner.periods.monthly, desc: t.planner.periodDesc.monthly },
    { key: 'weekly',  label: t.planner.periods.weekly,  desc: t.planner.periodDesc.weekly  },
    { key: 'daily',   label: t.planner.periods.daily,   desc: t.planner.periodDesc.daily   },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.planner.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📂</Text>
          <Text style={styles.emptyTitle}>{t.planner.noCatsTitle}</Text>
          <Text style={styles.emptySub}>{t.planner.noCatsDesc}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Period selector */}
            <View style={styles.periodRow}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, period === p.key && styles.periodChipActive]}
                  onPress={() => handlePeriodChange(p.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodLabel, period === p.key && styles.periodLabelActive]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.periodDesc, period === p.key && styles.periodDescActive]}>
                    {p.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Total budget card */}
            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>{t.planner.totalBudget}</Text>
                <Text style={styles.totalAmount}>{formatMoney(totalBudget)} €</Text>
              </View>
              <View style={[styles.countBadge, filledCount > 0 && styles.countBadgeActive]}>
                <Text style={[styles.countBadgeText, filledCount > 0 && styles.countBadgeTextActive]}>
                  {t.planner.categories(filledCount)}
                </Text>
              </View>
            </View>

            {/* Category rows */}
            <View style={styles.catCard}>
              {categories.map((cat, index) => {
                const existing = hasExisting(cat.id);
                return (
                  <View key={cat.id} style={[styles.catRow, index > 0 && styles.catRowBorder]}>
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                      <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                    </View>
                    <View style={styles.catMeta}>
                      <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                      {existing && (
                        <View style={styles.existingTag}>
                          <View style={styles.existingDot} />
                          <Text style={styles.existingText}>{t.planner.existingTag}</Text>
                        </View>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.amountInput,
                        amounts[cat.id] && parseFloat(amounts[cat.id]) > 0 && styles.amountInputFilled,
                      ]}
                      value={amounts[cat.id] || ''}
                      onChangeText={text => {
                        const formatted = formatAmount(text, amounts[cat.id] || '');
                        setAmounts(prev => ({ ...prev, [cat.id]: formatted }));
                      }}
                      placeholder={t.planner.placeholder}
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      selectTextOnFocus
                    />
                    <Text style={styles.amountSuffix}>€</Text>
                  </View>
                );
              })}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Sticky bottom button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || filledCount === 0) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || filledCount === 0}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText} numberOfLines={1}>
                    {t.planner.activateBtn(filledCount, formatMoney(totalBudget))}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  // Period selector
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  periodChip: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  periodChipActive: { backgroundColor: Colors.primary + '12', borderColor: Colors.primary },
  periodLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  periodLabelActive: { color: Colors.primary },
  periodDesc: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  periodDescActive: { color: Colors.primary + 'CC' },

  // Total card
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  totalLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: '600', letterSpacing: 0.5 },
  totalAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countBadgeText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  countBadgeTextActive: { color: '#fff' },

  // Category list
  catCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    gap: Spacing.sm,
  },
  catRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  catIcon: {
    width: 42, height: 42, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catMeta: { flex: 1, minWidth: 0 },
  catName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  existingTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  existingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  existingText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },

  amountInput: {
    width: 90, textAlign: 'right',
    fontSize: FontSize.md, fontWeight: '600',
    color: Colors.textSecondary,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
  },
  amountInputFilled: { color: Colors.textPrimary },
  amountSuffix: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, width: 16 },

  // Bottom footer
  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
