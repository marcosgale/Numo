import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, Trash2 } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
};

type Goal = {
  id: string;
  name: string;
  emoji: string | null;
  target_amount: number;
  current_amount: number;
};

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dólar americano' },
  { code: 'GBP', symbol: '£', name: 'Libra esterlina' },
  { code: 'CHF', symbol: 'Fr', name: 'Franco suizo' },
  { code: 'SEK', symbol: 'kr', name: 'Corona sueca' },
  { code: 'DKK', symbol: 'kr', name: 'Corona danesa' },
  { code: 'NOK', symbol: 'kr', name: 'Corona noruega' },
  { code: 'PLN', symbol: 'zł', name: 'Złoty polaco' },
  { code: 'CZK', symbol: 'Kč', name: 'Corona checa' },
  { code: 'JPY', symbol: '¥', name: 'Yen japonés' },
  { code: 'TRY', symbol: '₺', name: 'Lira turca' },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano' },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño' },
  { code: 'ARS', symbol: '$', name: 'Peso argentino' },
  { code: 'COP', symbol: '$', name: 'Peso colombiano' },
  { code: 'THB', symbol: '฿', name: 'Baht tailandés' },
];

export default function AddTransactionScreen({ route, navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const { type, isRecurring, transaction } = route.params;
  const isEditing = !!transaction;

  const [amount, setAmount] = useState(isEditing ? String(transaction.amount) : '');
  const [concept, setConcept] = useState(isEditing ? (transaction.description || '') : '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(isEditing ? transaction.category_id : null);
  const [currency, setCurrency] = useState(
    isEditing ? (CURRENCIES.find(c => c.code === transaction.currency) || CURRENCIES[0]) : CURRENCIES[0]
  );
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [baseAmount, setBaseAmount] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState(
    isEditing ? (transaction.recurrence_period || 'monthly') : 'monthly'
  );
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalAllocations, setGoalAllocations] = useState<{ [goalId: string]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .eq('user_id', user.id)
        .order('name');
      if (cats) setCategories(cats);

      const { data: profile } = await supabase
        .from('profiles')
        .select('currency')
        .eq('id', user.id)
        .single();
      if (profile?.currency) {
        setBaseCurrency(profile.currency);
        if (!isEditing) {
          const userCurrency = CURRENCIES.find(c => c.code === profile.currency);
          if (userCurrency) setCurrency(userCurrency);
        }
      }

      if (type === 'income' && !isEditing) {
        const { data: goalsData } = await supabase
          .from('goals')
          .select('id, name, emoji, target_amount, current_amount')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (goalsData) {
          setGoals(goalsData.filter(
            g => Number(g.current_amount) < Number(g.target_amount)
          ));
        }
      }
    };
    fetchData();
  }, [type]);

  useEffect(() => {
    const convert = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setBaseAmount(null);
        return;
      }

      if (currency.code === baseCurrency) {
        setBaseAmount(parseFloat(amount));
        return;
      }

      setConverting(true);
      try {
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=${currency.code}&to=${baseCurrency}&amount=${parseFloat(amount)}`
        );
        const data = await response.json();
        if (data.rates && data.rates[baseCurrency]) {
          setBaseAmount(Math.round(data.rates[baseCurrency] * 100) / 100);
        }
      } catch (error) {
        console.log('Error de conversión:', error);
        setBaseAmount(null);
      }
      setConverting(false);
    };

    const timeout = setTimeout(convert, 500);
    return () => clearTimeout(timeout);
  }, [amount, currency.code, baseCurrency]);

  const totalAllocated = Object.values(goalAllocations)
    .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.common.error, t.addTransaction.errors.invalidAmount);
      return;
    }
    if (baseAmount === null) {
      Alert.alert(t.common.error, t.addTransaction.errors.waitingConversion);
      return;
    }

    if (type === 'income' && totalAllocated > parseFloat(amount)) {
      Alert.alert(t.common.error, t.addTransaction.errors.overAllocated);
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert(t.common.error, t.addTransaction.errors.noSession);
      setLoading(false);
      return;
    }

    const transactionData = {
      category_id: selectedCategory,
      amount: parseFloat(amount),
      type: type,
      description: concept.trim() || null,
      is_recurring: isRecurring,
      currency: currency.code,
      base_amount: baseAmount,
      recurrence_period: isRecurring ? recurrencePeriod : null,
    };

    let error;

    if (isEditing) {
      ({ error } = await supabase
        .from('transactions')
        .update(transactionData)
        .eq('id', transaction.id));
    } else {
      const today = new Date().toISOString().split('T')[0];
      ({ error } = await supabase.from('transactions').insert({
        ...transactionData,
        user_id: user.id,
        date: today,
      }));
    }

    if (error) {
      setLoading(false);
      Alert.alert(t.common.error, error.message);
      return;
    }

    // Si es ingreso y hay asignaciones a metas, crear transacciones de ahorro
    if (type === 'income' && !isEditing && totalAllocated > 0) {
      // Buscar categoría "Ahorro"
      const { data: ahorroCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Ahorro')
        .eq('type', 'expense')
        .single();

      const today = new Date().toISOString().split('T')[0];

      for (const [goalId, allocationStr] of Object.entries(goalAllocations)) {
        const allocation = parseFloat(allocationStr);
        if (!allocation || allocation <= 0) continue;

        const goalData = goals.find(g => g.id === goalId);
        if (!goalData) continue;

        // Crear transacción de ahorro
        await supabase.from('transactions').insert({
          user_id: user.id,
          category_id: ahorroCategory?.id || null,
          amount: allocation,
          base_amount: allocation,
          type: 'expense',
          description: `Ahorro → ${goalData.name}`,
          date: today,
          is_recurring: false,
          currency: baseCurrency,
          goal_id: goalId,
        });

        // Actualizar current_amount de la meta
        const newAmount = Number(goalData.current_amount) + allocation;
        await supabase
          .from('goals')
          .update({ current_amount: newAmount })
          .eq('id', goalId);
      }
    }

    setLoading(false);

    const savedMsg = totalAllocated > 0
      ? t.addTransaction.success.savedGoals(totalAllocated.toFixed(2))
      : '';

    Alert.alert(
      isEditing ? t.addTransaction.success.updated : isRecurring ? t.addTransaction.success.recurring : type === 'expense' ? t.addTransaction.success.expense : t.addTransaction.success.income,
      savedMsg,
      [{ text: t.common.ok, onPress: () => navigation.goBack() }]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t.addTransaction.deleteTransaction,
      t.addTransaction.deleteConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', transaction.id);
            setLoading(false);

            if (error) {
              Alert.alert(t.common.error, error.message);
            } else {
              Alert.alert(t.addTransaction.deleted, t.addTransaction.deletedMsg, [
                { text: t.common.ok, onPress: () => navigation.goBack() },
              ]);
            }
          },
        },
      ]
    );
  };

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount;
    if (parts[1]?.length > 2) return amount;
    return cleaned;
  };

  const updateGoalAllocation = (goalId: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setGoalAllocations(prev => ({
      ...prev,
      [goalId]: cleaned,
    }));
  };

  const baseCurrencySymbol = CURRENCIES.find(c => c.code === baseCurrency)?.symbol || '€';

  const getHeaderTitle = () => {
    if (isEditing) return isRecurring ? t.addTransaction.editRecurring : type === 'expense' ? t.addTransaction.editExpense : t.addTransaction.editIncome;
    return isRecurring ? t.addTransaction.newRecurring : type === 'expense' ? t.addTransaction.newExpense : t.addTransaction.newIncome;
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
          {isEditing ? (
            <TouchableOpacity onPress={handleDelete}>
              <Trash2 size={22} color={Colors.negative} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* IMPORTE + MONEDA */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>{t.addTransaction.amount}</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={amount}
                onChangeText={(text) => setAmount(formatAmount(text))}
                keyboardType="decimal-pad"
                autoFocus={!isEditing}
              />
              <TouchableOpacity
                style={styles.currencyButton}
                onPress={() => setCurrencyModalVisible(true)}
              >
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {currency.code !== baseCurrency && amount && parseFloat(amount) > 0 && (
              <View style={styles.conversionRow}>
                {converting ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : baseAmount !== null ? (
                  <Text style={styles.conversionText}>
                    ≈ {baseAmount.toFixed(2)} {baseCurrencySymbol}
                  </Text>
                ) : (
                  <Text style={styles.conversionError}>{t.addTransaction.conversionError}</Text>
                )}
              </View>
            )}
          </View>

          {/* CONCEPTO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addTransaction.concept}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.addTransaction.conceptPlaceholder}
              placeholderTextColor={Colors.textSecondary}
              value={concept}
              onChangeText={setConcept}
            />
          </View>

          {/* FRECUENCIA */}
          {isRecurring && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.addTransaction.frequency}</Text>
              <View style={styles.periodRow}>
                {t.addTransaction.periods.map((period) => (
                  <TouchableOpacity
                    key={period.value}
                    style={[
                      styles.periodChip,
                      recurrencePeriod === period.value && styles.periodChipActive,
                    ]}
                    onPress={() => setRecurrencePeriod(period.value)}
                  >
                    <Text style={[
                      styles.periodLabel,
                      recurrencePeriod === period.value && styles.periodLabelActive,
                    ]}>
                      {period.label}
                    </Text>
                    <Text style={[
                      styles.periodDesc,
                      recurrencePeriod === period.value && styles.periodDescActive,
                    ]}>
                      {period.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* AVISO RECURRENTES */}
          {isRecurring && (
            <View style={styles.recurringNotice}>
              <Text style={styles.recurringNoticeText}>
                {t.addTransaction.recurringNotice}
              </Text>
            </View>
          )}

          {/* CATEGORÍAS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.addTransaction.categoryOptional}</Text>
            <View style={styles.categoryGrid}>
              {selectedCategory && (
                <TouchableOpacity
                  style={[styles.categoryChip, { backgroundColor: Colors.border + '40', borderColor: Colors.border }]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={styles.categoryName}>{t.addTransaction.remove}</Text>
                </TouchableOpacity>
              )}
              {categories.map((cat) => (
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
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* APARTAR PARA METAS (solo ingresos, no edición) */}
          {type === 'income' && !isEditing && goals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.addTransaction.allocateGoals}</Text>
              <View style={styles.goalsCard}>
                {goals.map((goal) => {
                  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
                  const progress = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
                  return (
                    <View key={goal.id} style={styles.goalAllocationRow}>
                      <View style={styles.goalAllocationInfo}>
                        <Text style={styles.goalAllocationEmoji}>{goal.emoji || '🎯'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.goalAllocationName}>{goal.name}</Text>
                          <Text style={styles.goalAllocationSub}>
                            {t.addTransaction.goalsLeft(formatMoney(remaining), String(Math.round(progress)))}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.goalAllocationInput}>
                        <TextInput
                          style={styles.goalInput}
                          placeholder="0"
                          placeholderTextColor={Colors.textSecondary}
                          value={goalAllocations[goal.id] || ''}
                          onChangeText={(text) => updateGoalAllocation(goal.id, text)}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.goalInputCurrency}>€</Text>
                      </View>
                    </View>
                  );
                })}
                {totalAllocated > 0 && (
                  <View style={styles.allocationSummary}>
                    <Text style={styles.allocationSummaryLabel}>{t.addTransaction.totalAllocated}</Text>
                    <Text style={styles.allocationSummaryAmount}>{formatMoney(totalAllocated)}€</Text>
                    {amount && parseFloat(amount) > 0 && (
                      <Text style={styles.allocationRemaining}>
                        {t.addTransaction.remaining(formatMoney(parseFloat(amount) - totalAllocated))}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* BOTÓN GUARDAR */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading || converting}
          >
            <Text style={styles.buttonText}>
              {loading ? t.addTransaction.saving : isEditing ? t.addTransaction.update : t.addTransaction.save}
            </Text>
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={18} color={Colors.negative} />
              <Text style={styles.deleteText}>{t.addTransaction.deleteTransaction}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* MODAL MONEDA */}
        <Modal
          visible={currencyModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.addTransaction.selectCurrency}</Text>
                <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                  <Text style={styles.modalClose}>{t.common.close}</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={CURRENCIES}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.currencyRow,
                      currency.code === item.code && styles.currencyRowActive,
                    ]}
                    onPress={() => {
                      setCurrency(item);
                      setCurrencyModalVisible(false);
                    }}
                  >
                    <Text style={styles.currencyRowSymbol}>{item.symbol}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currencyRowCode}>{item.code}</Text>
                      <Text style={styles.currencyRowName}>{item.name}</Text>
                    </View>
                    {currency.code === item.code && (
                      <Text style={styles.currencyCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
  amountSection: { marginBottom: Spacing.lg },
  amountLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  currencySymbol: { fontSize: 32, fontWeight: '700', color: Colors.textSecondary, marginRight: 4 },
  conversionRow: { marginTop: Spacing.xs },
  conversionText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  conversionError: { fontSize: FontSize.sm, color: Colors.negative },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
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
  recurringNotice: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  recurringNoticeText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
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
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  goalsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  goalAllocationRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  goalAllocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  goalAllocationEmoji: { fontSize: 24, marginRight: Spacing.sm },
  goalAllocationName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  goalAllocationSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  goalAllocationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    marginTop: 4,
  },
  goalInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: Spacing.sm,
  },
  goalInputCurrency: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  allocationSummary: {
    paddingTop: Spacing.sm,
    alignItems: 'center',
  },
  allocationSummaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  allocationSummaryAmount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  allocationRemaining: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.negative + '10',
  },
  deleteText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.negative, marginLeft: Spacing.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalClose: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  currencyRowActive: { backgroundColor: Colors.primary + '10' },
  currencyRowSymbol: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, width: 40 },
  currencyRowCode: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  currencyRowName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  currencyCheck: { fontSize: 18, color: Colors.primary, fontWeight: '700' },
});