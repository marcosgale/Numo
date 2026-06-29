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
  goal_id: string | null;
  categories: {
    name: string;
    icon: string;
    color: string;
  } | null;
};

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  emoji: string | null;
};

type LimitWithSpent = {
  id: string;
  amount: number;
  period: string;
  spent: number;
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [firstName, setFirstName] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTx, setRecurringTx] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [limits, setLimits] = useState<LimitWithSpent[]>([]);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthSavings, setMonthSavings] = useState(0);
  const [totalInGoals, setTotalInGoals] = useState(0);
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
      .select('base_amount, type, goal_id')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (monthTx) {
      const income = monthTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.base_amount), 0);
      const savings = monthTx
        .filter(t => t.type === 'expense' && t.goal_id !== null)
        .reduce((sum, t) => sum + Number(t.base_amount), 0);
      const expenses = monthTx
        .filter(t => t.type === 'expense' && t.goal_id === null)
        .reduce((sum, t) => sum + Number(t.base_amount), 0);
      setMonthIncome(income);
      setMonthExpenses(expenses);
      setMonthSavings(savings);
    }

    const { data: recentTx } = await supabase
      .from('transactions')
      .select('id, amount, base_amount, type, description, date, is_recurring, recurrence_period, currency, category_id, goal_id, categories(name, icon, color)')
      .eq('is_recurring', false)
      .is('goal_id', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentTx) setTransactions(recentTx as any);

    const { data: recurring } = await supabase
      .from('transactions')
      .select('id, amount, base_amount, type, description, date, is_recurring, recurrence_period, currency, category_id, goal_id, categories(name, icon, color)')
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });

    if (recurring) setRecurringTx(recurring as any);

    const { data: goalsData } = await supabase
      .from('goals')
      .select('id, name, target_amount, current_amount, emoji')
      .order('created_at', { ascending: false })
      .limit(3);

    if (goalsData) {
      setGoals(goalsData);
      setTotalInGoals(goalsData.reduce((sum, g) => sum + Number(g.current_amount), 0));
    }

    // Límites con gasto calculado
    const { data: limitsData } = await supabase
      .from('limits')
      .select('id, amount, period, categories(id, name, icon, color)')
      .order('created_at', { ascending: false });

    if (limitsData && limitsData.length > 0) {
      const limitsWithSpent: LimitWithSpent[] = [];

      for (const limit of limitsData as any) {
        let startDate: string;

        if (limit.period === 'daily') {
          startDate = now.toISOString().split('T')[0];
        } else if (limit.period === 'weekly') {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
          startDate = weekStart.toISOString().split('T')[0];
        } else {
          startDate = startOfMonth;
        }

        const { data: txData } = await supabase
          .from('transactions')
          .select('base_amount')
          .eq('category_id', limit.categories.id)
          .eq('type', 'expense')
          .gte('date', startDate)
          .is('goal_id', null);

        const spent = txData
          ? txData.reduce((sum: number, t: any) => sum + Number(t.base_amount), 0)
          : 0;

        limitsWithSpent.push({ ...limit, spent });
      }

      setLimits(limitsWithSpent);
    }

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

  const getGoalProgress = (current: number, target: number) => {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getLimitBarColor = (pct: number) => {
    if (pct >= 100) return Colors.negative;
    if (pct >= 80) return Colors.warning;
    return Colors.primary;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const available = monthIncome - monthExpenses - monthSavings;
  const total = available + totalInGoals;

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
          <Text style={styles.balanceLabel}>DINERO DISPONIBLE</Text>
          <Text style={[styles.balanceAmount, { color: available >= 0 ? '#fff' : Colors.negative }]}>
            {available >= 0 ? '' : '-'}{formatMoney(Math.abs(available))} €
          </Text>
          <Text style={styles.balanceUpdated}>
            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Ingresos</Text>
              <Text style={styles.balanceMiniPos}>+{formatMoney(monthIncome)}€</Text>
            </View>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Gastos</Text>
              <Text style={styles.balanceMiniNeg}>-{formatMoney(monthExpenses)}€</Text>
            </View>
          </View>
          {monthSavings > 0 && (
            <View style={[styles.balanceMini, { marginTop: Spacing.xs }]}>
              <Text style={styles.balanceMiniLabel}>Ahorrado para metas</Text>
              <Text style={[styles.balanceMiniPos, { color: '#FFD60A' }]}>-{formatMoney(monthSavings)}€</Text>
            </View>
          )}
        </View>

        {/* TU DINERO TOTAL */}
        {totalInGoals > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalTitle}>Tu dinero total</Text>
            <View style={styles.totalRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>Disponible</Text>
                <Text style={styles.totalValue}>{formatMoney(Math.max(available, 0))}€</Text>
              </View>
              <Text style={styles.totalPlus}>+</Text>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>En metas</Text>
                <Text style={[styles.totalValue, { color: Colors.primary }]}>{formatMoney(totalInGoals)}€</Text>
              </View>
              <Text style={styles.totalPlus}>=</Text>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalValue, { color: Colors.positive }]}>{formatMoney(total)}€</Text>
              </View>
            </View>
          </View>
        )}

        {/* LÍMITES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Límites del mes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Limits')}>
              <Text style={styles.sectionLink}>Ver todos {'>'}</Text>
            </TouchableOpacity>
          </View>
          {limits.length > 0 ? (
            <View style={styles.card}>
              {limits.slice(0, 3).map((limit, index) => {
                const pct = Math.min((limit.spent / Number(limit.amount)) * 100, 100);
                const barColor = getLimitBarColor(pct);
                const isOver = limit.spent > Number(limit.amount);

                return (
                  <TouchableOpacity
                    key={limit.id}
                    style={[styles.limitRow, index < Math.min(limits.length, 3) - 1 && styles.txBorder]}
                    onPress={() => navigation.navigate('Limits')}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.limitIcon, { backgroundColor: limit.categories.color + '15' }]}>
                      <Text style={{ fontSize: 16 }}>{limit.categories.icon}</Text>
                    </View>
                    <View style={styles.limitInfo}>
                      <View style={styles.limitTop}>
                        <Text style={styles.txName}>{limit.categories.name}</Text>
                        <Text style={[styles.limitAmount, isOver && { color: Colors.negative }]}>
                          {formatMoney(limit.spent)}€ / {formatMoney(Number(limit.amount))}€
                        </Text>
                      </View>
                      <View style={styles.limitBar}>
                        <View style={[styles.limitBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyCard}
              onPress={() => navigation.navigate('Limits')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>Sin límites configurados</Text>
              <Text style={styles.emptySub}>Toca aquí para establecer topes de gasto</Text>
            </TouchableOpacity>
          )}
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

        {/* METAS */}
        {goals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tus metas</Text>
            </View>
            <View style={styles.card}>
              {goals.map((goal, index) => {
                const progress = getGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.goalRow, index < goals.length - 1 && styles.txBorder]}
                    onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.goalEmoji}>{goal.emoji || '🎯'}</Text>
                    <View style={styles.goalInfo}>
                      <Text style={styles.txName}>{goal.name}</Text>
                      <View style={styles.goalProgressBar}>
                        <View style={[styles.goalProgressFill, { width: `${progress}%` as any }]} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.goalPercent}>{Math.round(progress)}%</Text>
                      <Text style={styles.goalAmounts}>{formatMoney(Number(goal.current_amount))}€</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
  balanceCard: { backgroundColor: '#1C3A30', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.sm },
  balanceLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 4 },
  balanceUpdated: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.md },
  balanceRow: { flexDirection: 'row', gap: Spacing.sm },
  balanceMini: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  balanceMiniLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  balanceMiniPos: { fontSize: FontSize.md, fontWeight: '700', color: Colors.positive },
  balanceMiniNeg: { fontSize: FontSize.md, fontWeight: '700', color: Colors.negative },
  totalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  totalTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, textAlign: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  totalItem: { alignItems: 'center', flex: 1 },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  totalValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  totalPlus: { fontSize: FontSize.lg, color: Colors.textSecondary, marginHorizontal: 4 },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary },
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
  limitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  limitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  limitInfo: { flex: 1 },
  limitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  limitAmount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  limitBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  limitBarFill: { height: '100%', borderRadius: 3 },
  recurringRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  recurringRight: { alignItems: 'flex-end' },
  recurringAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  recurringPeriod: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  goalEmoji: { fontSize: 28, marginRight: Spacing.sm },
  goalInfo: { flex: 1, marginRight: Spacing.sm },
  goalProgressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  goalProgressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  goalPercent: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  goalAmounts: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
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