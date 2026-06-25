import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
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

export default function GoalsScreen() {
  const navigation = useNavigation<any>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchGoals = async () => {
        setLoading(true);
        const { data } = await supabase
          .from('goals')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setGoals(data);
        setLoading(false);
      };
      fetchGoals();
    }, [])
  );

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getProgress = (current: number, target: number) => {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getDaysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    const end = new Date(deadline + 'T00:00:00');
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Vencida';
    if (diff === 0) return 'Hoy';
    if (diff === 1) return '1 día';
    return `${diff} días`;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return Colors.positive;
    if (progress >= 60) return Colors.primary;
    if (progress >= 30) return Colors.warning;
    return Colors.negative;
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
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tus metas</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddGoal')}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {goals.length > 0 ? (
          <>
            {/* RESUMEN */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Metas activas</Text>
                  <Text style={styles.summaryValue}>{goals.filter(g => getProgress(g.current_amount, g.target_amount) < 100).length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Completadas</Text>
                  <Text style={[styles.summaryValue, { color: Colors.positive }]}>
                    {goals.filter(g => getProgress(g.current_amount, g.target_amount) >= 100).length}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total ahorrado</Text>
                  <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                    {formatMoney(goals.reduce((sum, g) => sum + Number(g.current_amount), 0))}€
                  </Text>
                </View>
              </View>
            </View>

            {/* LISTA DE METAS */}
            {goals.map((goal) => {
              const progress = getProgress(Number(goal.current_amount), Number(goal.target_amount));
              const daysLeft = getDaysLeft(goal.deadline);
              const progressColor = getProgressColor(progress);

              return (
                <TouchableOpacity
                  key={goal.id}
                  style={styles.goalCard}
                  onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalEmoji}>{goal.emoji || '🎯'}</Text>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      {daysLeft && (
                        <Text style={[styles.goalDeadline, daysLeft === 'Vencida' && { color: Colors.negative }]}>
                          {daysLeft === 'Vencida' ? '⚠️ Vencida' : `⏳ ${daysLeft} restantes`}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.progressBadge, { backgroundColor: progressColor + '15' }]}>
                      <Text style={[styles.progressBadgeText, { color: progressColor }]}>
                        {Math.round(progress)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: progressColor }]} />
                  </View>

                  <View style={styles.goalFooter}>
                    <Text style={styles.goalSaved}>{formatMoney(Number(goal.current_amount))}€ ahorrados</Text>
                    <Text style={styles.goalTarget}>de {formatMoney(Number(goal.target_amount))}€</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyText}>Crea tu primera meta</Text>
            <Text style={styles.emptySub}>Establece objetivos de ahorro y sigue tu progreso</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddGoal')}
            >
              <Text style={styles.emptyButtonText}>Crear meta</Text>
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  goalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  goalEmoji: { fontSize: 32, marginRight: Spacing.sm },
  goalInfo: { flex: 1 },
  goalName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  goalDeadline: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  progressBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  progressBadgeText: { fontSize: FontSize.sm, fontWeight: '700' },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  goalSaved: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  goalTarget: { fontSize: FontSize.sm, color: Colors.textSecondary },
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