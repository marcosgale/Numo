import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { CANONICAL_CAT_KEY } from '../data/categories';

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  currency: string;
  category_id: string | null;
  goal_id: string | null;
  group_expense_id: string | null;
  categories: {
    name: string;
    icon: string;
    color: string;
  } | null;
};

export default function HistoryScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const translateCatName = (name: string) => {
    const key = CANONICAL_CAT_KEY[name.toLowerCase()];
    if (!key) return name;
    return (t.planner.items as Record<string, string>)[key] ?? name;
  };
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    setLoading(true);

    let query = supabase
      .from('transactions')
      .select('id, amount, type, description, date, is_recurring, currency, category_id, goal_id, group_expense_id, categories(name, icon, color)')
      .is('goal_id', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'expense') {
      query = query.eq('type', 'expense');
    } else if (filter === 'income') {
      query = query.eq('type', 'income');
    } else if (filter === 'recurring') {
      query = query.eq('is_recurring', true);
    }

    const { data } = await query;
    if (data) setTransactions(data as any);
    setLoading(false);
  };

  const formatMoney = (value: number) =>
    value.toLocaleString(t.history.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t.common.today;
    if (date.toDateString() === yesterday.toDateString()) return t.common.yesterday;

    return date.toLocaleDateString(t.history.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Agrupar por fecha
  const groupedTransactions: { [date: string]: Transaction[] } = {};
  transactions.forEach(tx => {
    const dateKey = tx.date;
    if (!groupedTransactions[dateKey]) groupedTransactions[dateKey] = [];
    groupedTransactions[dateKey].push(tx);
  });

  const handleEdit = (tx: Transaction) => {
    navigation.navigate('AddTransaction', {
      type: tx.type,
      isRecurring: tx.is_recurring,
      transaction: {
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        category_id: tx.category_id,
        currency: tx.currency,
        date: tx.date,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.history.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* FILTROS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {t.history.filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : transactions.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDate(date)}</Text>
              <View style={styles.card}>
                {txs.map((tx, index) => {
                    const isGroup = !!tx.group_expense_id;
                    return (
                      <TouchableOpacity
                        key={tx.id}
                        style={[styles.txRow, index < txs.length - 1 && styles.txBorder]}
                        onPress={isGroup ? undefined : () => handleEdit(tx)}
                        activeOpacity={isGroup ? 1 : 0.6}
                      >
                        <View style={[styles.txIcon, { backgroundColor: isGroup ? '#1DB87A15' : (tx.categories?.color || '#8E8E93') + '15' }]}>
                          <Text style={{ fontSize: 18 }}>{isGroup ? '👥' : (tx.categories?.icon || '📦')}</Text>
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txName}>
                            {tx.description || (tx.categories?.name ? translateCatName(tx.categories.name) : null) || t.history.noConcept}
                          </Text>
                          <Text style={styles.txCategory}>
                            {isGroup ? t.history.sharedExpense : (tx.categories?.name ? translateCatName(tx.categories.name) : t.history.noCategory)}
                            {tx.is_recurring ? ' · 🔄' : ''}
                          </Text>
                        </View>
                        <Text style={[
                          styles.txAmount,
                          { color: tx.type === 'income' ? Colors.positive : Colors.textPrimary }
                        ]}>
                          {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)} {tx.currency === 'EUR' ? '€' : tx.currency}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>{t.history.noMovements}</Text>
          <Text style={styles.emptySub}>
            {filter !== 'all' ? t.history.tryAnotherFilter : t.history.noMovementsSub}
          </Text>
        </View>
      )}
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
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.primary, fontWeight: '700' },
  container: { paddingHorizontal: Spacing.lg },
  dateGroup: { marginBottom: Spacing.md },
  dateHeader: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  txBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  txInfo: { flex: 1 },
  txName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  txCategory: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txAmount: { fontSize: FontSize.md, fontWeight: '700' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});