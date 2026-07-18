import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { TextInput } from 'react-native';
import { CANONICAL_CAT_KEY } from '../data/categories';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export default function AddLimitScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const translateCatName = (name: string) => {
    const key = CANONICAL_CAT_KEY[name.toLowerCase()];
    if (!key) return name;
    return (t.planner.items as Record<string, string>)[key] ?? name;
  };
  const PERIODS = t.addLimit.periods;
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingLimits, setExistingLimits] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Categorías de gasto (sin "Ahorro")
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('type', 'expense')
        .eq('user_id', user.id)
        .neq('name', 'Ahorro')
        .order('name');

      if (cats) setCategories(cats);

      // Categorías que ya tienen límite
      const { data: limits } = await supabase
        .from('limits')
        .select('category_id')
        .eq('user_id', user.id);

      if (limits) setExistingLimits(limits.map(l => l.category_id));
    };
    fetchData();
  }, []);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount;
    if (parts[1]?.length > 2) return amount;
    return cleaned;
  };

  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert(t.common.error, t.addLimit.errors.noCategory);
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.common.error, t.addLimit.errors.invalidAmount);
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('limits').insert({
      user_id: user.id,
      category_id: selectedCategory,
      amount: parseFloat(amount),
      period: period,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(t.addLimit.successTitle, t.addLimit.successMsg, [
        { text: t.common.ok, onPress: () => navigation.goBack() },
      ]);
    }
  };

  const availableCategories = categories.filter(c => !existingLimits.includes(c.id));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.addLimit.title}</Text>
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
        {/* CATEGORÍA */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.addLimit.categoryLabel}</Text>
          {availableCategories.length > 0 ? (
            <View style={styles.categoryGrid}>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.categoryName,
                    selectedCategory === cat.id && { color: cat.color, fontWeight: '700' },
                  ]}>
                    {translateCatName(cat.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noCats}>{t.addLimit.noCats}</Text>
          )}
        </View>

        {/* IMPORTE */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.addLimit.amountLabel}</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              value={amount}
              onChangeText={(text) => setAmount(formatAmount(text))}
              keyboardType="decimal-pad"
            />
            <Text style={styles.amountCurrency}>€</Text>
          </View>
        </View>

        {/* PERIODO */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.addLimit.periodLabel}</Text>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.periodChip,
                  period === p.value && styles.periodChipActive,
                ]}
                onPress={() => setPeriod(p.value)}
              >
                <Text style={[
                  styles.periodLabel,
                  period === p.value && styles.periodLabelActive,
                ]}>
                  {p.label}
                </Text>
                <Text style={[
                  styles.periodDesc,
                  period === p.value && styles.periodDescActive,
                ]}>
                  {p.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BOTÓN */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading || !selectedCategory}
        >
          <Text style={styles.buttonText}>
            {loading ? t.addLimit.saving : t.addLimit.save}
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
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  categoryIcon: { fontSize: 16, marginRight: 4 },
  categoryName: { fontSize: FontSize.sm, color: Colors.textPrimary },
  noCats: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountCurrency: { fontSize: 32, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.sm },
  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  periodChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  periodLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  periodLabelActive: { color: Colors.primary },
  periodDesc: { fontSize: FontSize.xs, color: Colors.textSecondary },
  periodDescActive: { color: Colors.primary },
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