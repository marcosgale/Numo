import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, Trash2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
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

const PERIODS = [
  { value: 'weekly', label: 'Semanal', description: 'Cada semana' },
  { value: 'monthly', label: 'Mensual', description: 'Cada mes' },
  { value: 'yearly', label: 'Anual', description: 'Cada año' },
];

export default function AddTransactionScreen({ route, navigation }: any) {
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .order('name');
      if (cats) setCategories(cats);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Introduce un importe válido');
      return;
    }
    if (baseAmount === null) {
      Alert.alert('Error', 'Esperando conversión de moneda...');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'No hay sesión activa');
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

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        isEditing ? '¡Actualizado!' : isRecurring ? '¡Gasto recurrente registrado!' : type === 'expense' ? '¡Gasto registrado!' : '¡Ingreso registrado!',
        '',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar movimiento',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', transaction.id);
            setLoading(false);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Eliminado', 'El movimiento ha sido eliminado', [
                { text: 'OK', onPress: () => navigation.goBack() },
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

  const baseCurrencySymbol = CURRENCIES.find(c => c.code === baseCurrency)?.symbol || '€';

  const getHeaderTitle = () => {
    if (isEditing) return isRecurring ? 'Editar recurrente' : type === 'expense' ? 'Editar gasto' : 'Editar ingreso';
    return isRecurring ? 'Nuevo gasto recurrente' : type === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso';
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
            <Text style={styles.amountLabel}>Importe</Text>
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
                    ≈ {baseAmount.toFixed(2)} {baseCurrencySymbol} al cambio actual
                  </Text>
                ) : (
                  <Text style={styles.conversionError}>No se pudo obtener el tipo de cambio</Text>
                )}
              </View>
            )}
          </View>

          {/* CONCEPTO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Concepto</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Netflix, Mercadona, Alquiler..."
              placeholderTextColor={Colors.textSecondary}
              value={concept}
              onChangeText={setConcept}
            />
          </View>

          {/* FRECUENCIA (solo si es recurrente) */}
          {isRecurring && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Frecuencia</Text>
              <View style={styles.periodRow}>
                {PERIODS.map((period) => (
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

          {/* CATEGORÍAS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Categoría (opcional)</Text>
            <View style={styles.categoryGrid}>
              {selectedCategory && (
                <TouchableOpacity
                  style={[styles.categoryChip, { backgroundColor: Colors.border + '40', borderColor: Colors.border }]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={styles.categoryName}>✕ Quitar</Text>
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

          {/* BOTÓN GUARDAR */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading || converting}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
            </Text>
          </TouchableOpacity>

          {/* BOTÓN ELIMINAR (solo en edición) */}
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={18} color={Colors.negative} />
              <Text style={styles.deleteText}>Eliminar movimiento</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* MODAL SELECTOR DE MONEDA */}
        <Modal
          visible={currencyModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar moneda</Text>
                <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                  <Text style={styles.modalClose}>Cerrar</Text>
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
  periodDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  periodDescActive: { color: Colors.primary },
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