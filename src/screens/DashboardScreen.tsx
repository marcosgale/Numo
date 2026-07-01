import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
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
  group_expense_id: string | null;
  categories: { name: string; icon: string; color: string } | null;
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
  categories: { id: string; name: string; icon: string; color: string };
};

export default function DashboardScreen() {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const navigation = useNavigation<any>();

  const [firstName, setFirstName] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [limits, setLimits] = useState<LimitWithSpent[]>([]);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthSavings, setMonthSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días,';
    if (h < 20) return 'Buenas tardes,';
    return 'Buenas noches,';
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles').select('first_name').eq('id', user.id).single();
    if (profile) setFirstName(profile.first_name || '');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Totales del mes
    const { data: monthTx } = await supabase
      .from('transactions')
      .select('base_amount, type, goal_id')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (monthTx) {
      setMonthIncome(monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.base_amount), 0));
      setMonthSavings(monthTx.filter(t => t.type === 'expense' && t.goal_id !== null).reduce((s, t) => s + Number(t.base_amount), 0));
      setMonthExpenses(monthTx.filter(t => t.type === 'expense' && t.goal_id === null).reduce((s, t) => s + Number(t.base_amount), 0));
    }

    // Últimos 4 movimientos (sin recurrentes ni metas)
    const { data: recentTx } = await supabase
      .from('transactions')
      .select('id, amount, base_amount, type, description, date, is_recurring, recurrence_period, currency, category_id, goal_id, group_expense_id, categories(name, icon, color)')
      .eq('is_recurring', false)
      .is('goal_id', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(4);
    if (recentTx) setTransactions(recentTx as any);

    // Metas (máximo 3)
    const { data: goalsData } = await supabase
      .from('goals').select('id, name, target_amount, current_amount, emoji')
      .order('created_at', { ascending: false }).limit(3);
    if (goalsData) setGoals(goalsData);

    // Límites con gasto real
    const { data: limitsData } = await supabase
      .from('limits').select('id, amount, period, categories(id, name, icon, color)')
      .order('created_at', { ascending: false });

    if (limitsData && limitsData.length > 0) {
      const result: LimitWithSpent[] = [];
      for (const limit of limitsData as any) {
        let startDate: string;
        if (limit.period === 'daily') {
          startDate = now.toISOString().split('T')[0];
        } else if (limit.period === 'weekly') {
          const ws = new Date(now);
          ws.setDate(ws.getDate() - ws.getDay() + 1);
          startDate = ws.toISOString().split('T')[0];
        } else {
          startDate = startOfMonth;
        }
        const { data: txData } = await supabase
          .from('transactions').select('base_amount')
          .eq('category_id', limit.categories.id).eq('type', 'expense')
          .gte('date', startDate).is('goal_id', null);
        result.push({
          ...limit,
          spent: txData ? txData.reduce((s: number, t: any) => s + Number(t.base_amount), 0) : 0,
        });
      }
      setLimits(result);
    } else {
      setLimits([]);
    }

    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleEditTransaction = (tx: Transaction) => {
    navigation.navigate('AddTransaction', {
      type: tx.type,
      isRecurring: tx.is_recurring,
      transaction: {
        id: tx.id, amount: tx.amount, description: tx.description,
        category_id: tx.category_id, currency: tx.currency,
        recurrence_period: tx.recurrence_period, date: tx.date,
      },
    });
  };

  const formatMoney = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getLimitColor = (pct: number) => {
    if (pct >= 100) return Colors.negative;
    if (pct >= 80) return Colors.warning;
    return Colors.positive;
  };

  const getGoalProgress = (current: number, target: number) =>
    target <= 0 ? 0 : Math.min((current / target) * 100, 100);

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
  const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{firstName} 👋</Text>
        </View>

        {/* TARJETA BALANCE */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceMonth}>{monthLabel}</Text>
          <Text style={[styles.balanceAmount, { color: available >= 0 ? '#fff' : '#FF6B6B' }]}>
            {available >= 0 ? '' : '-'}{formatMoney(Math.abs(available))} €
          </Text>
          <Text style={styles.balanceLabel}>disponible</Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statArrow}>↑</Text>
              <View>
                <Text style={styles.statLabel}>Ingresos</Text>
                <Text style={styles.statPos}>+{formatMoney(monthIncome)}€</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text style={styles.statArrowNeg}>↓</Text>
              <View>
                <Text style={styles.statLabel}>Gastos</Text>
                <Text style={styles.statNeg}>-{formatMoney(monthExpenses)}€</Text>
              </View>
            </View>
            {monthSavings > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statPill}>
                  <Text style={{ fontSize: 14 }}>🐷</Text>
                  <View>
                    <Text style={styles.statLabel}>Ahorrado</Text>
                    <Text style={styles.statSav}>{formatMoney(monthSavings)}€</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* LÍMITES */}
        {limits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Límites</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Limits')}>
                <Text style={styles.sectionLink}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {limits.slice(0, 3).map((limit, i) => {
                const pct = Math.min((limit.spent / Number(limit.amount)) * 100, 100);
                const color = getLimitColor(pct);
                return (
                  <TouchableOpacity
                    key={limit.id}
                    style={[styles.compactRow, i > 0 && styles.rowBorder]}
                    onPress={() => navigation.navigate('Limits')}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.rowEmoji}>{limit.categories.icon}</Text>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName}>{limit.categories.name}</Text>
                        <Text style={[styles.rowPct, { color }]}>{Math.round(pct)}%</Text>
                      </View>
                      <View style={styles.thinBar}>
                        <View style={[styles.thinBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* METAS */}
        {goals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Metas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Planifica')}>
                <Text style={styles.sectionLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {goals.slice(0, 2).map((goal, i) => {
                const progress = getGoalProgress(Number(goal.current_amount), Number(goal.target_amount));
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.compactRow, i > 0 && styles.rowBorder]}
                    onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowEmoji}>{goal.emoji || '🎯'}</Text>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName}>{goal.name}</Text>
                        <Text style={[styles.rowPct, { color: Colors.primary }]}>
                          {formatMoney(Number(goal.current_amount))}€
                        </Text>
                      </View>
                      <View style={styles.thinBar}>
                        <View style={[styles.thinBarFill, { width: `${progress}%` as any, backgroundColor: Colors.primary }]} />
                      </View>
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
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {transactions.length > 0 ? (
            <View style={styles.card}>
              {transactions.map((tx, i) => {
                const isGroup = !!tx.group_expense_id;
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.txRow, i > 0 && styles.rowBorder]}
                    onPress={isGroup ? undefined : () => handleEditTransaction(tx)}
                    activeOpacity={isGroup ? 1 : 0.6}
                  >
                    <View style={[styles.txIcon, {
                      backgroundColor: isGroup
                        ? Colors.primary + '15'
                        : (tx.categories?.color || Colors.textSecondary) + '15',
                    }]}>
                      <Text style={{ fontSize: 18 }}>
                        {isGroup ? '👥' : (tx.categories?.icon || '📦')}
                      </Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName} numberOfLines={1}>
                        {tx.description || tx.categories?.name || 'Sin concepto'}
                      </Text>
                      <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                    </View>
                    <Text style={[styles.txAmount, {
                      color: tx.type === 'income' ? Colors.positive : Colors.negative,
                    }]}>
                      {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                      {tx.currency === 'EUR' ? '€' : ` ${tx.currency}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyText}>Sin movimientos este mes</Text>
              <Text style={styles.emptySub}>Pulsa + para añadir tu primer gasto</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  header: { marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.sm, color: Colors.textSecondary },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },

  balanceCard: {
    backgroundColor: '#1C3A30',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  balanceMonth: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'capitalize',
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 4 },
  statArrow: { fontSize: 16, color: '#30D158', fontWeight: '700' },
  statArrowNeg: { fontSize: 16, color: '#FF453A', fontWeight: '700' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 1 },
  statPos: { fontSize: FontSize.sm, fontWeight: '700', color: '#30D158' },
  statNeg: { fontSize: FontSize.sm, fontWeight: '700', color: '#FF453A' },
  statSav: { fontSize: FontSize.sm, fontWeight: '700', color: '#FFD60A' },

  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },

  compactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowEmoji: { fontSize: 22, marginRight: Spacing.sm, width: 28, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  rowName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  rowPct: { fontSize: FontSize.sm, fontWeight: '700' },
  thinBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  thinBarFill: { height: '100%', borderRadius: 2 },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  txInfo: { flex: 1, marginRight: Spacing.sm },
  txName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  txDate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  txAmount: { fontSize: FontSize.md, fontWeight: '700' },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center',
  },
  emptyEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
