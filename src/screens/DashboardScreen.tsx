import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Transaction = {
  id: string;
  amount: number;
  base_amount: number;
  type: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurrence_period: string | null;
  currency: string;
  category_id: string | null;
  categories: {
    name: string;
    icon: string;
    color: string;
  } | null;
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [firstName, setFirstName] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTx, setRecurringTx] = useState<Transaction[]>([]);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días,';
    if (hour < 20) return 'Buenas tardes,';
    return 'Buenas noches,';
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single();

    if (profile) setFirstName(profile.first_name || '');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: monthTx } = await supabase
      .from('transactions')
      .select('base_amount, type')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (monthTx) {
      const income = monthTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.base_amount), 0);
      const expenses = monthTx
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.base_amount), 0);
      setMonthIncome(income);
      setMonthExpenses(expenses);
    }

    const { data: recentTx } = await supabase
      .from('transactions')
      .select('id, amount, base_amount, type, description, date, is_recurring, recurrence_period, currency, category_id, categories(name, icon, color)')
      .eq('is_recurring', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentTx) setTransactions(recentTx as any);

    const { data: recurring } = await supabase
      .from('transactions')
      .select('id, amount, base_amount, type, description, date, is_recurring, recurrence_period, currency, category_id, categories(name, icon, color)')
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });

    if (recurring) setRecurringTx(recurring as any);

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const handleEditTransaction = (tx: Transaction) => {
    navigation.navigate('AddTransaction', {
      type: tx.type,
      isRecurring: tx.is_recurring,
      transaction: {
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        category_id: tx.category_id,
        currency: tx.currency,
        recurrence_period: tx.recurrence_period,
        date: tx.date,
      },
    });
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getPeriodLabel = (period: string | null) => {
    switch (period) {
      case 'weekly': return '/ semana';
      case 'monthly': return '/ mes';
      case 'yearly': return '/ año';
      default: return '/ mes';
    }
  };

  const getNextDate = (dateString: string, period: string | null) => {
    const date = new Date(dateString + 'T00:00:00');
    const now = new Date();

    switch (period) {
      case 'weekly':
        while (date <= now) date.setDate(date.getDate() + 7);
        break;
      case 'yearly':
        while (date <= now) date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        while (date <= now) date.setMonth(date.getMonth() + 1);
        break;
    }

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const monthlyRecurringTotal = recurringTx.reduce((sum, tx) => {
    const amount = Number(tx.base_amount);
    switch (tx.recurrence_period) {
      case 'weekly': return sum + (amount * 4.33);
      case 'yearly': return sum + (amount / 12);
      default: return sum + amount;
    }
  }, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const balance = monthIncome - monthExpenses;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Bell size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* TARJETA SALDO */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO DEL MES</Text>
          <Text style={[styles.balanceAmount, { color: balance >= 0 ? '#fff' : Colors.negative }]}>
            {balance >= 0 ? '' : '-'}{formatMoney(Math.abs(balance))} €
          </Text>
          <Text style={styles.balanceUpdated}>
            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Ingresos</Text>
              <Text style={styles.balanceMiniPos}>+{formatMoney(monthIncome)}€</Text>
              <Text style={styles.balanceMiniSub}>Este mes</Text>
            </View>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Gastos</Text>
              <Text style={styles.balanceMiniNeg}>-{formatMoney(monthExpenses)}€</Text>
              <Text style={styles.balanceMiniSub}>Este mes</Text>
            </View>
          </View>
        </View>

        {/* GASTOS RECURRENTES */}
        {recurringTx.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gastos recurrentes</Text>
            </View>
            <View style={styles.recurringTotal}>
              <Text style={styles.recurringTotalLabel}>Total mensual estimado</Text>
              <Text style={styles.recurringTotalAmount}>-{formatMoney(monthlyRecurringTotal)}€</Text>
            </View>
            <View style={styles.card}>
              {recurringTx.map((tx, index) => (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.recurringRow, index < recurringTx.length - 1 && styles.txBorder]}
                  onPress={() => handleEditTransaction(tx)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.txIcon, { backgroundColor: (tx.categories?.color || '#8E8E93') + '15' }]}>
                    <Text style={{ fontSize: 18 }}>{tx.categories?.icon || '🔄'}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName}>{tx.description || tx.categories?.name || 'Sin concepto'}</Text>
                    <Text style={styles.txCategory}>
                      Próximo: {getNextDate(tx.date, tx.recurrence_period)}
                    </Text>
                  </View>
                  <View style={styles.recurringRight}>
                    <Text style={styles.recurringAmount}>
                      -{formatMoney(tx.amount)} {tx.currency === 'EUR' ? '€' : tx.currency}
                    </Text>
                    <Text style={styles.recurringPeriod}>{getPeriodLabel(tx.recurrence_period)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ÚLTIMOS MOVIMIENTOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Últimos movimientos</Text>
          </View>
          {transactions.length > 0 ? (
            <View style={styles.card}>
              {transactions.map((tx, index) => (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txRow, index < transactions.length - 1 && styles.txBorder]}
                  onPress={() => handleEditTransaction(tx)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.txIcon, { backgroundColor: (tx.categories?.color || '#8E8E93') + '15' }]}>
                    <Text style={{ fontSize: 18 }}>{tx.categories?.icon || '📦'}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName}>{tx.description || tx.categories?.name || 'Sin concepto'}</Text>
                    <Text style={styles.txCategory}>
                      {tx.categories?.name || 'Sin categoría'} · {formatDate(tx.date)}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'income' ? Colors.positive : Colors.textPrimary }]}>
                    {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)} {tx.currency === 'EUR' ? '€' : tx.currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyText}>Aún no tienes movimientos</Text>
              <Text style={styles.emptySub}>Pulsa el botón + para añadir tu primer gasto o ingreso</Text>
            </View>
          )}
        </View>

        {/* LÍMITES DEL MES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Límites del mes</Text>
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>Sin límites configurados</Text>
            <Text style={styles.emptySub}>Próximamente podrás establecer límites por categoría</Text>
          </View>
        </View>

        {/* METAS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tus metas</Text>
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyText}>Sin metas de ahorro</Text>
            <Text style={styles.emptySub}>Próximamente podrás crear objetivos de ahorro</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.sm, color: Colors.textSecondary },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  balanceCard: { backgroundColor: '#1C3A30', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  balanceLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 4 },
  balanceUpdated: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.md },
  balanceRow: { flexDirection: 'row', gap: Spacing.sm },
  balanceMini: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  balanceMiniLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  balanceMiniPos: { fontSize: FontSize.md, fontWeight: '700', color: Colors.positive },
  balanceMiniNeg: { fontSize: FontSize.md, fontWeight: '700', color: Colors.negative },
  balanceMiniSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  recurringTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recurringTotalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  recurringTotalAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.negative },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  recurringRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  recurringRight: { alignItems: 'flex-end' },
  recurringAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  recurringPeriod: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  txBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  txInfo: { flex: 1 },
  txName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  txCategory: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txAmount: { fontSize: FontSize.md, fontWeight: '700' },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});