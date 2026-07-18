import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2 } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  emoji: string | null;
  created_at: string;
};

type Limit = {
  id: string;
  amount: number;
  period: string;
  categories: { id: string; name: string; icon: string; color: string };
};

type SpentMap = { [categoryId: string]: number };
type Tab = 'plan' | 'goals' | 'limits';

// Maps canonical Spanish names → planner translation key
const CANONICAL_KEY: Record<string, string> = {
  'vivienda': 'vivienda', 'alimentación': 'alimentacion', 'alimentacion': 'alimentacion',
  'transporte': 'transporte', 'facturas': 'facturas', 'ocio': 'ocio',
  'compras': 'compras', 'suscripciones': 'suscripciones', 'salud': 'salud',
  'ahorro': 'ahorro', 'hogar': 'hogar', 'educación': 'educacion', 'educacion': 'educacion',
  'otros': 'otros', 'restaurantes': 'restaurantes', 'ropa': 'ropa',
  'mascota': 'mascota', 'mascotas': 'mascota', 'deporte': 'deporte',
  'viaje': 'viaje', 'viajes': 'viaje', 'tecnología': 'tecnologia', 'tecnologia': 'tecnologia',
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function GoalsScreen() {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const navigation = useNavigation<any>();

  const translateCatName = (name: string) => {
    const key = CANONICAL_KEY[name.toLowerCase()];
    return key ? ((t.planner.items as Record<string, string>)[key] ?? name) : name;
  };

  const [tab, setTab] = useState<Tab>('plan');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [spent, setSpent] = useState<SpentMap>({});
  const [loadingLimits, setLoadingLimits] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchGoals();
      fetchLimits();
    }, [])
  );

  // Keep a stable ref to fetchLimits so the navigation listener never captures a stale closure
  const fetchLimitsRef = useRef<() => Promise<void>>();
  useEffect(() => { fetchLimitsRef.current = fetchLimits; });

  // AddTransaction/AddGoal/AddLimit are root-stack modals — on iOS they do NOT blur
  // the tab screen below, so useFocusEffect never re-fires after they dismiss.
  // Listening to the parent (root stack) state change catches every push/pop, so
  // fetchLimits runs once when the modal closes and the data stays current.
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    const unsubscribe = parent.addListener('state', () => {
      fetchLimitsRef.current?.();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchGoals = async () => {
    setLoadingGoals(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingGoals(false); return; }
    const { data } = await supabase
      .from('goals').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setGoals(data);
    setLoadingGoals(false);
  };

  const fetchLimits = async () => {
    setLoadingLimits(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingLimits(false); return; }

    const { data: limitsData } = await supabase
      .from('limits')
      .select('id, amount, period, categories(id, name, icon, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (limitsData) setLimits(limitsData as any);

    const spentMap: SpentMap = {};

    if (limitsData && limitsData.length > 0) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      // Monday-based week start
      const dow = now.getDay();
      const diffToMonday = (dow === 0 ? 6 : dow - 1);
      const weekStartDate = new Date(now);
      weekStartDate.setDate(now.getDate() - diffToMonday);
      const startOfWeek = weekStartDate.toISOString().split('T')[0];

      const categoryIds = (limitsData as any[])
        .map(l => l.categories?.id)
        .filter(Boolean);

      // Single batched query — one round-trip for all limits
      const { data: txData } = await supabase
        .from('transactions')
        .select('category_id, amount, base_amount, date')
        .eq('type', 'expense')
        .eq('user_id', user.id)
        .in('category_id', categoryIds)
        .gte('date', startOfMonth)   // covers monthly, weekly, and daily
        .is('goal_id', null);

      const allTx = (txData || []) as any[];

      for (const limit of limitsData as any[]) {
        const catId = limit.categories?.id;
        if (!catId) continue;

        // Choose the cutoff date for this limit's period
        let cutoff: string;
        if (limit.period === 'daily') cutoff = today;
        else if (limit.period === 'weekly') cutoff = startOfWeek;
        else cutoff = startOfMonth;

        const catTx = allTx.filter(tx => tx.category_id === catId && tx.date >= cutoff);
        spentMap[catId] = catTx.reduce(
          // base_amount is the amount in the user's base currency; fall back to amount if null
          (sum: number, tx: any) => sum + Number(tx.base_amount ?? tx.amount),
          0
        );
      }
    }

    setSpent(spentMap);
    setLoadingLimits(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatMoney = (value: number) =>
    value.toLocaleString(t.dashboard.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getProgress = (current: number, target: number) =>
    target <= 0 ? 0 : Math.min((current / target) * 100, 100);

  const getDaysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = Math.ceil(
      (new Date(deadline + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) return t.goals.expired;
    if (diff === 0) return t.common.today;
    if (diff === 1) return `1 ${t.goals.day}`;
    return `${diff} ${t.goals.days}`;
  };

  const getGoalColor = (progress: number) => {
    if (progress >= 100) return Colors.positive;
    if (progress === 0) return Colors.textSecondary;
    return Colors.primary;
  };

  const getLimitColor = (pct: number) => {
    if (pct >= 100) return Colors.negative;
    if (pct >= 80) return Colors.warning;
    return Colors.primary;
  };

  const getPeriodLabel = (period: string) => {
    if (period === 'daily') return t.goals.periods.daily;
    if (period === 'weekly') return t.goals.periods.weekly;
    return t.goals.periods.monthly;
  };

  const handleDeleteLimit = (limitId: string, categoryName: string) => {
    Alert.alert(t.goals.deleteLimit, t.goals.deleteLimitMsg(categoryName), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive',
        onPress: async () => {
          await supabase.from('limits').delete().eq('id', limitId);
          setLimits(prev => prev.filter(l => l.id !== limitId));
        },
      },
    ]);
  };

  const handleDeleteGoal = (goalId: string, goalName: string) => {
    Alert.alert(
      t.goals.deleteGoalTitle,
      t.goals.deleteGoalMsg(goalName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete, style: 'destructive',
          onPress: async () => {
            await supabase.from('goals').delete().eq('id', goalId);
            setGoals(prev => prev.filter(g => g.id !== goalId));
          },
        },
      ]
    );
  };

  const handleDeleteAllLimits = () => {
    Alert.alert(
      t.goals.deleteAllLimitsTitle,
      t.goals.deleteAllLimitsMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete, style: 'destructive',
          onPress: async () => {
            const ids = limits.map(l => l.id);
            await supabase.from('limits').delete().in('id', ids);
            setLimits([]);
          },
        },
      ]
    );
  };

  const handleDeletePlan = () => {
    Alert.alert(
      t.goals.deletePlanTitle,
      t.goals.deletePlanMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete, style: 'destructive',
          onPress: async () => {
            const ids = monthlyLimits.map(l => l.id);
            await supabase.from('limits').delete().in('id', ids);
            setLimits(prev => prev.filter(l => l.period !== 'monthly'));
          },
        },
      ]
    );
  };

  // ── FAB route per tab ─────────────────────────────────────────────────────
  const getAddRoute = () => {
    if (tab === 'plan') return 'Planner';
    if (tab === 'goals') return 'AddGoal';
    return 'AddLimit';
  };

  const isLoading = tab === 'goals' ? loadingGoals : (tab === 'limits' ? loadingLimits : false);

  // ── Plan tab: monthly limits ───────────────────────────────────────────────
  const monthlyLimits = limits.filter(l => l.period === 'monthly');
  const totalMonthlyBudget = monthlyLimits.reduce((sum, l) => sum + Number(l.amount), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.goals.title}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate(getAddRoute())}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 3-tab bar */}
      <View style={styles.tabsBar}>
        {(['plan', 'goals', 'limits'] as Tab[]).map(tabKey => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tabItem, tab === tabKey && styles.tabItemActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {tabKey === 'plan'
                ? t.goals.planTab
                : tabKey === 'goals'
                  ? t.goals.goalsTab
                  : t.goals.limitsTab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* ══════════════════ PLAN TAB ══════════════════ */}
          {tab === 'plan' && (
            monthlyLimits.length > 0 ? (
              <>
                {/* Monthly budget summary card */}
                <View style={styles.planSummaryCard}>
                  <View style={styles.planSummaryTop}>
                    <View>
                      <Text style={styles.planSummaryLabel}>{t.goals.monthlyBudget}</Text>
                      <Text style={styles.planSummaryAmount}>{formatMoney(totalMonthlyBudget)} €</Text>
                    </View>
                    <View style={styles.planCatBadge}>
                      <Text style={styles.planCatNum}>{monthlyLimits.length}</Text>
                      <Text style={styles.planCatLabel}>{t.planner.categories(monthlyLimits.length)}</Text>
                    </View>
                  </View>
                  <View style={styles.planActions}>
                    <TouchableOpacity
                      style={styles.editPlanBtn}
                      onPress={() => navigation.navigate('Planner')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.editPlanBtnText}>{t.goals.editPlan}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deletePlanBtn}
                      onPress={handleDeletePlan}
                      activeOpacity={0.8}
                    >
                      <Trash2 size={16} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Monthly limits with progress */}
                {monthlyLimits.map(limit => {
                  const catSpent = spent[limit.categories.id] || 0;
                  const pct = Math.min((catSpent / Number(limit.amount)) * 100, 100);
                  const barColor = getLimitColor(pct);
                  const isOver = catSpent > Number(limit.amount);
                  return (
                    <View key={limit.id} style={styles.limitCard}>
                      <View style={styles.limitHeader}>
                        <View style={[styles.limitIcon, { backgroundColor: limit.categories.color + '15' }]}>
                          <Text style={{ fontSize: 20 }}>{limit.categories.icon}</Text>
                        </View>
                        <View style={styles.limitInfo}>
                          <Text style={styles.limitName}>{translateCatName(limit.categories.name)}</Text>
                          <Text style={styles.limitPeriod}>{getPeriodLabel(limit.period)}</Text>
                        </View>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                      </View>
                      <View style={styles.limitFooter}>
                        <Text style={[styles.limitSpent, isOver && { color: Colors.negative }]}>
                          {formatMoney(catSpent)} €
                        </Text>
                        <Text style={styles.limitTotal}>{t.goals.of} {formatMoney(Number(limit.amount))} €</Text>
                      </View>
                      {isOver && (
                        <View style={styles.overBadge}>
                          <Text style={styles.overText}>{t.goals.exceeded(formatMoney(catSpent - Number(limit.amount)))}</Text>
                        </View>
                      )}
                      {pct >= 80 && !isOver && (
                        <View style={styles.warningBadge}>
                          <Text style={styles.warningText}>{t.goals.nearLimit(String(Math.round(pct)))}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>{t.goals.emptyPlanTitle}</Text>
                <Text style={styles.emptySub}>{t.goals.emptyPlanSub}</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Planner')}>
                  <Text style={styles.emptyButtonText}>{t.planner.createPlan}</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* ══════════════════ GOALS TAB ══════════════════ */}
          {tab === 'goals' && (
            goals.length > 0 ? (
              <>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>
                        {goals.filter(g => getProgress(g.current_amount, g.target_amount) < 100).length}
                      </Text>
                      <Text style={styles.summaryLabel}>{t.goals.active}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, { color: Colors.positive }]}>
                        {goals.filter(g => getProgress(g.current_amount, g.target_amount) >= 100).length}
                      </Text>
                      <Text style={styles.summaryLabel}>{t.goals.completed}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                        {formatMoney(goals.reduce((sum, g) => sum + Number(g.current_amount), 0))} €
                      </Text>
                      <Text style={styles.summaryLabel}>{t.goals.totalSaved}</Text>
                    </View>
                  </View>
                </View>

                {goals.map(goal => {
                  const progress = getProgress(Number(goal.current_amount), Number(goal.target_amount));
                  const daysLeft = getDaysLeft(goal.deadline);
                  const color = getGoalColor(progress);
                  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
                  const isComplete = progress >= 100;
                  const isExpired = daysLeft === t.goals.expired;

                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={styles.goalCard}
                      onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })}
                      activeOpacity={0.7}
                    >
                      {/* Top row: emoji + name + deadline + trash */}
                      <View style={styles.goalCardTop}>
                        <View style={[styles.goalEmojiBox, { backgroundColor: color + '18' }]}>
                          <Text style={styles.goalEmoji}>{goal.emoji || '🎯'}</Text>
                        </View>
                        <View style={styles.goalTitleGroup}>
                          <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                          {daysLeft && (
                            <Text style={[styles.goalDeadlineTxt, isExpired && { color: Colors.negative }]}>
                              {isExpired ? `⚠️ ${t.goals.expired}` : `⏳ ${daysLeft} ${t.goals.remaining}`}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteGoal(goal.id, goal.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>

                      {/* Progress bar + percentage */}
                      <View style={styles.goalBarRow}>
                        <View style={styles.goalBar}>
                          {progress > 0 && (
                            <View
                              style={[
                                styles.goalBarFill,
                                { width: `${Math.min(progress, 100)}%` as any, backgroundColor: color },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={[styles.goalBarPct, { color }]}>
                          {Math.round(progress)}%
                        </Text>
                      </View>

                      {/* Amount row */}
                      <View style={styles.goalAmountRow}>
                        <Text style={[styles.goalSavedAmt, { color }]}>
                          {formatMoney(Number(goal.current_amount))} €
                        </Text>
                        <Text style={styles.goalTargetAmt}>
                          {t.common.of} {formatMoney(Number(goal.target_amount))} €
                        </Text>
                        {isComplete ? (
                          <Text style={[styles.goalRemainingTxt, { color: Colors.positive }]}>
                            ✓ {t.goals.completed}
                          </Text>
                        ) : (
                          remaining > 0 && (
                            <Text style={styles.goalRemainingTxt}>
                              {formatMoney(remaining)} € {t.goals.remaining}
                            </Text>
                          )
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyTitle}>{t.goals.emptyGoalTitle}</Text>
                <Text style={styles.emptySub}>{t.goals.emptyGoalSub}</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('AddGoal')}>
                  <Text style={styles.emptyButtonText}>{t.goals.createGoal}</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {/* ══════════════════ LIMITS TAB ══════════════════ */}
          {tab === 'limits' && (
            limits.length > 0 ? (
              <>
              <TouchableOpacity style={styles.deleteAllRow} onPress={handleDeleteAllLimits} activeOpacity={0.7}>
                <Trash2 size={15} color={Colors.negative} />
                <Text style={styles.deleteAllText}>{t.goals.deleteAllLimits}</Text>
              </TouchableOpacity>
              {limits.map(limit => {
                const catSpent = spent[limit.categories.id] || 0;
                const pct = Math.min((catSpent / Number(limit.amount)) * 100, 100);
                const barColor = getLimitColor(pct);
                const isOver = catSpent > Number(limit.amount);
                return (
                  <View key={limit.id} style={styles.limitCard}>
                    <View style={styles.limitHeader}>
                      <View style={[styles.limitIcon, { backgroundColor: limit.categories.color + '15' }]}>
                        <Text style={{ fontSize: 20 }}>{limit.categories.icon}</Text>
                      </View>
                      <View style={styles.limitInfo}>
                        <Text style={styles.limitName}>{translateCatName(limit.categories.name)}</Text>
                        <Text style={styles.limitPeriod}>{getPeriodLabel(limit.period)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteLimit(limit.id, translateCatName(limit.categories.name))}>
                        <Trash2 size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <View style={styles.limitFooter}>
                      <Text style={[styles.limitSpent, isOver && { color: Colors.negative }]}>
                        {formatMoney(catSpent)} €
                      </Text>
                      <Text style={styles.limitTotal}>{t.goals.of} {formatMoney(Number(limit.amount))} €</Text>
                    </View>
                    {isOver && (
                      <View style={styles.overBadge}>
                        <Text style={styles.overText}>{t.goals.exceeded(formatMoney(catSpent - Number(limit.amount)))}</Text>
                      </View>
                    )}
                    {pct >= 80 && !isOver && (
                      <View style={styles.warningBadge}>
                        <Text style={styles.warningText}>{t.goals.nearLimit(String(Math.round(pct)))}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📊</Text>
                <Text style={styles.emptyTitle}>{t.goals.emptyLimitTitle}</Text>
                <Text style={styles.emptySub}>{t.goals.emptyLimitSub}</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('AddLimit')}>
                  <Text style={styles.emptyButtonText}>{t.goals.createLimit}</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  // 3-tab bar
  tabsBar: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: 4, marginBottom: Spacing.md,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.md },
  tabItemActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  container: { paddingHorizontal: Spacing.lg },

  // Plan tab — summary card
  planSummaryCard: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    shadowColor: Colors.primary, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  planSummaryTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  planSummaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: '600', letterSpacing: 0.4 },
  planSummaryAmount: { fontSize: 26, fontWeight: '700', color: '#fff' },
  planCatBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center',
  },
  planCatNum: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  planCatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  planActions: { flexDirection: 'row', gap: Spacing.sm },
  editPlanBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  editPlanBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  deletePlanBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },

  // Goals tab — summary
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Goal card
  goalCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  goalCardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  goalEmojiBox: {
    width: 42, height: 42, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  goalEmoji: { fontSize: 22 },
  goalTitleGroup: { flex: 1 },
  goalName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  goalDeadlineTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  goalBarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm,
  },
  goalBar: {
    flex: 1, height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden',
  },
  goalBarFill: { height: '100%', borderRadius: 4 },
  goalBarPct: { fontSize: 11, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  goalAmountRow: {
    flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4,
  },
  goalSavedAmt: { fontSize: FontSize.md, fontWeight: '700' },
  goalTargetAmt: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  goalRemainingTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },

  deleteAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4,
  },
  deleteAllText: { fontSize: FontSize.xs, color: Colors.negative, fontWeight: '600' },

  // Limit card (shared between Plan and Limits tabs)
  limitCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  limitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  limitIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  limitInfo: { flex: 1 },
  limitName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  limitPeriod: { fontSize: FontSize.xs, color: Colors.textSecondary },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', borderRadius: 4 },
  limitFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  limitSpent: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  limitTotal: { fontSize: FontSize.sm, color: Colors.textSecondary },
  overBadge: {
    backgroundColor: Colors.negative + '10', borderRadius: BorderRadius.sm,
    padding: Spacing.xs, paddingHorizontal: Spacing.sm, marginTop: Spacing.xs,
  },
  overText: { fontSize: FontSize.xs, color: Colors.negative, fontWeight: '500' },
  warningBadge: {
    backgroundColor: Colors.warning + '15', borderRadius: BorderRadius.sm,
    padding: Spacing.xs, paddingHorizontal: Spacing.sm, marginTop: Spacing.xs,
  },
  warningText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '500' },

  // Empty state (shared)
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20 },
  emptyButton: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
  },
  emptyButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
