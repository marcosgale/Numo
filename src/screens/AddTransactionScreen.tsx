import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
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

export default function AddTransactionScreen({ route, navigation }: any) {
  const { type, isRecurring } = route.params;

  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Cargar categorías
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .order('name');
      if (cats) setCategories(cats);

      // Cargar moneda del perfil del usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('currency')
          .eq('id', user.id)
          .single();
        if (profile?.currency) {
          const userCurrency = CURRENCIES.find(c => c.code === profile.currency);
          if (userCurrency) setCurrency(userCurrency);
        }
      }
    };
    fetchData();
  }, [type]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Introduce un importe válido');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Selecciona una categoría');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'No hay sesión activa');
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      category_id: selectedCategory,
      amount: parseFloat(amount),
      type: type,
      description: concept.trim() || null,
      date: today,
      is_recurring: isRecurring,
      currency: currency.code,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        isRecurring ? '¡Gasto recurrente registrado!' : type === 'expense' ? '¡Gasto registrado!' : '¡Ingreso registrado!',
        '',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount;
    if (parts[1]?.length > 2) return amount;
    return cleaned;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isRecurring ? 'Nuevo gasto recurrente' : type === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso'}
          </Text>
          <View style={{ width: 28 }} />
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
                autoFocus
              />
              <TouchableOpacity
                style={styles.currencyButton}
                onPress={() => setCurrencyModalVisible(true)}
              >
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
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

          {/* CATEGORÍAS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Categoría</Text>
            <View style={styles.categoryGrid}>
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
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
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