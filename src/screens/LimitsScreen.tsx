import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Limit = {
  id: string;
  amount: number;
  period: string;
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
};

type SpentMap = { [categoryId: string]: number };

export default function LimitsScreen() {
  const navigation = useNavigation<any>();
  const [limits, setLimits] = useState<Limit[]>([]);
  const [spent, setSpent] = useState<SpentMap>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);

        const { data: limitsData } = await supabase
          .from('limits')
          .select('id, amount, period, categories(id, name, icon, color)')
          .order('created_at', { ascending: false });

        if (limitsData) setLimits(limitsData as any);

        // Calcular gasto por categoría según periodo
        const now = new Date();
        const spentMap: SpentMap = {};

        if (limitsData) {
          for (const limit of limitsData as any) {
            let startDate: string;

            if (limit.period === 'daily') {
              startDate = now.toISOString().split('T')[0];
            } else if (limit.period === 'weekly') {
              const weekStart = new Date(now);
              weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
              startDate = weekStart.toISOString().split('T')[0];
            } else {
              startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            }

            const { data: txData } = await supabase
              .from('transactions')
              .select('base_amount')
              .eq('category_id', limit.categories.id)
              .eq('type', 'expense')
              .gte('date', startDate)
              .is('goal_id', null);

            if (txData) {
              spentMap[limit.categories.id] = txData.reduce(
                (sum: number, t: any) => sum + Number(t.base_amount), 0
              );
            }
          }
        }

        setSpent(spentMap);
        setLoading(false);
      };
      fetchData();
    }, [])
  );

  const handleDelete = (limitId: string, categoryName: string) => {
    Alert.alert(
      'Eliminar límite',
      `¿Eliminar el límite de ${categoryName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('limits').delete().eq('id', limitId);
            setLimits(prev => prev.filter(l => l.id !== limitId));
          },
        },
      ]
    );
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'daily': return 'Diario';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensual';
      default: return period;
    }
  };

  const getBarColor = (pct: number) => {
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Límites de gasto</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddLimit')}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {limits.length > 0 ? (
          <>
            {limits.map((limit) => {
              const catSpent = spent[limit.categories.id] || 0;
              const pct = Math.min((catSpent / Number(limit.amount)) * 100, 100);
              const barColor = getBarColor(pct);
              const isOver = catSpent > Number(limit.amount);

              return (
                <View key={limit.id} style={styles.limitCard}>
                  <View style={styles.limitHeader}>
                    <View style={[styles.limitIcon, { backgroundColor: limit.categories.color + '15' }]}>
                      <Text style={{ fontSize: 20 }}>{limit.categories.icon}</Text>
                    </View>
                    <View style={styles.limitInfo}>
                      <Text style={styles.limitName}>{limit.categories.name}</Text>
                      <Text style={styles.limitPeriod}>{getPeriodLabel(limit.period)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(limit.id, limit.categories.name)}>
                      <Trash2 size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                  </View>

                  <View style={styles.limitFooter}>
                    <Text style={[styles.limitSpent, isOver && { color: Colors.negative }]}>
                      {formatMoney(catSpent)}€
                    </Text>
                    <Text style={styles.limitTotal}>de {formatMoney(Number(limit.amount))}€</Text>
                  </View>

                  {isOver && (
                    <View style={styles.overBadge}>
                      <Text style={styles.overText}>
                        ⚠️ Superado por {formatMoney(catSpent - Number(limit.amount))}€
                      </Text>
                    </View>
                  )}

                  {pct >= 80 && !isOver && (
                    <View style={styles.warningBadge}>
                      <Text style={styles.warningText}>
                        ⚡ Llevas el {Math.round(pct)}% del límite
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>Sin límites configurados</Text>
            <Text style={styles.emptySub}>Establece topes de gasto por categoría para controlar mejor tu dinero</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddLimit')}
            >
              <Text style={styles.emptyButtonText}>Crear límite</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  limitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  limitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
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
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  overText: { fontSize: FontSize.xs, color: Colors.negative, fontWeight: '500' },
  warningBadge: {
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  warningText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '500' },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  emptyButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});