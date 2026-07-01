import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ActivityIndicator, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Edit3, Trash2 } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

type Goal = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  emoji: string | null;
  created_at: string;
};

export default function GoalDetailScreen({ route, navigation }: any) {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { goalId } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchGoal = async () => {
        setLoading(true);
        const { data } = await supabase
          .from('goals')
          .select('*')
          .eq('id', goalId)
          .single();
        if (data) setGoal(data);
        setLoading(false);
      };
      fetchGoal();
    }, [goalId])
  );

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getProgress = () => {
    if (!goal || Number(goal.target_amount) <= 0) return 0;
    return Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
  };

  const getProgressColor = () => {
    const p = getProgress();
    if (p >= 100) return Colors.positive;
    if (p >= 60) return Colors.primary;
    if (p >= 30) return Colors.warning;
    return Colors.negative;
  };

  const getDaysLeft = () => {
    if (!goal?.deadline) return null;
    const end = new Date(goal.deadline + 'T00:00:00');
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Vencida';
    if (diff === 0) return 'Último día';
    return `${diff} días restantes`;
  };

  const handleAddMoney = async () => {
    if (!addAmount || parseFloat(addAmount) <= 0) {
      Alert.alert('Error', 'Introduce una cantidad válida');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }

    const savingsAmount = parseFloat(addAmount);
    const newAmount = Number(goal!.current_amount) + savingsAmount;

    // 1. Buscar la categoría "Ahorro" del usuario
    const { data: ahorroCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Ahorro')
      .eq('type', 'expense')
      .single();

    // 2. Crear la transacción de ahorro (aparece como gasto en el saldo)
    const today = new Date().toISOString().split('T')[0];
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: user.id,
      category_id: ahorroCategory?.id || null,
      amount: savingsAmount,
      base_amount: savingsAmount,
      type: 'expense',
      description: `Ahorro → ${goal!.name}`,
      date: today,
      is_recurring: false,
      currency: 'EUR',
      goal_id: goal!.id,
    });

    if (txError) {
      setSaving(false);
      Alert.alert('Error', txError.message);
      return;
    }

    // 3. Actualizar el current_amount de la meta
    const { error: goalError } = await supabase
      .from('goals')
      .update({ current_amount: newAmount })
      .eq('id', goalId);

    setSaving(false);

    if (goalError) {
      Alert.alert('Error', goalError.message);
    } else {
      setGoal({ ...goal!, current_amount: newAmount });
      setAddAmount('');
      Keyboard.dismiss();

      if (newAmount >= Number(goal!.target_amount)) {
        Alert.alert('🎉 ¡Meta cumplida!', `¡Has alcanzado tu objetivo de ${formatMoney(Number(goal!.target_amount))}€!`);
      } else {
        Alert.alert('💰 ¡Ahorrado!', `Llevas ${formatMoney(newAmount)}€ de ${formatMoney(Number(goal!.target_amount))}€`);
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar meta',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('goals').delete().eq('id', goalId);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  if (loading || !goal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const progress = getProgress();
  const progressColor = getProgressColor();
  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0);
  const daysLeft = getDaysLeft();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('AddGoal', { goal })}
            >
              <Edit3 size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
              <Trash2 size={20} color={Colors.negative} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTENIDO */}
        <View style={styles.container}>
          <View style={styles.titleSection}>
            <Text style={styles.emoji}>{goal.emoji || '🎯'}</Text>
            <Text style={styles.goalName}>{goal.name}</Text>
            {goal.description && (
              <Text style={styles.goalDescription}>{goal.description}</Text>
            )}
            {daysLeft && (
              <Text style={[styles.deadline, daysLeft === 'Vencida' && { color: Colors.negative }]}>
                {daysLeft === 'Vencida' ? '⚠️ Vencida' : `⏳ ${daysLeft}`}
              </Text>
            )}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressPercent, { color: progressColor }]}>{Math.round(progress)}%</Text>
              {progress >= 100 && <Text style={styles.completedBadge}>✅ Completada</Text>}
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: progressColor }]} />
            </View>
            <View style={styles.progressFooter}>
              <View>
                <Text style={styles.progressLabel}>Ahorrado</Text>
                <Text style={styles.progressValue}>{formatMoney(Number(goal.current_amount))}€</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.progressLabel}>Objetivo</Text>
                <Text style={styles.progressValue}>{formatMoney(Number(goal.target_amount))}€</Text>
              </View>
            </View>
            {remaining > 0 && (
              <Text style={styles.remainingText}>Te faltan {formatMoney(remaining)}€</Text>
            )}
          </View>

          {progress < 100 && (
            <View style={styles.addSection}>
              <Text style={styles.addLabel}>Añadir ahorro</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary}
                  value={addAmount}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setAddAmount(cleaned);
                  }}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.addCurrency}>€</Text>
                <TouchableOpacity
                  style={[styles.addButton, saving && styles.addButtonDisabled]}
                  onPress={handleAddMoney}
                  disabled={saving}
                >
                  <Text style={styles.addButtonText}>{saving ? '...' : 'Añadir'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { paddingHorizontal: Spacing.lg },
  titleSection: { alignItems: 'center', marginBottom: Spacing.lg },
  emoji: { fontSize: 56, marginBottom: Spacing.sm },
  goalName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  goalDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  deadline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  progressSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  progressPercent: { fontSize: 32, fontWeight: '700' },
  completedBadge: { fontSize: FontSize.sm, color: Colors.positive, fontWeight: '600' },
  progressBar: { height: 12, backgroundColor: Colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: Spacing.md },
  progressFill: { height: '100%', borderRadius: 6 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  progressValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  remainingText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md },
  addSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  addLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addCurrency: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, marginHorizontal: Spacing.xs },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});