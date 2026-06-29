import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Copy, LogOut } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

type Member = {
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
};

type GroupExpense = {
  id: string;
  amount: number;
  description: string;
  date: string;
  paid_by: string;
  payer_name: string;
};

type Balance = {
  userId: string;
  name: string;
  balance: number;
};

type Debt = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
};

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        // Grupo
        const { data: groupData } = await supabase
          .from('groups')
          .select('id, name, emoji, invite_code, created_by')
          .eq('id', groupId)
          .single();

        if (groupData) setGroup(groupData);

        // Miembros con perfil
        const { data: membersData } = await supabase
          .from('group_members')
          .select('user_id, profiles(first_name, last_name)')
          .eq('group_id', groupId);

        if (membersData) setMembers(membersData as any);

        // Gastos del grupo
        const { data: expensesData } = await supabase
          .from('group_expenses')
          .select('id, amount, description, date, paid_by')
          .eq('group_id', groupId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        // Splits para calcular balances
        const { data: splitsData } = await supabase
          .from('group_expense_splits')
          .select('group_expense_id, user_id, amount, is_paid')
          .in('group_expense_id', (expensesData || []).map(e => e.id));

        // Calcular nombres de pagadores y balances
        if (expensesData && membersData) {
          const memberMap: { [id: string]: string } = {};
          (membersData as any).forEach((m: any) => {
            memberMap[m.user_id] = `${m.profiles.first_name} ${m.profiles.last_name}`;
          });

          const expensesWithNames = expensesData.map(e => ({
            ...e,
            payer_name: memberMap[e.paid_by] || 'Desconocido',
          }));
          setExpenses(expensesWithNames);

          // Calcular balances
          const balanceMap: { [userId: string]: number } = {};
          (membersData as any).forEach((m: any) => {
            balanceMap[m.user_id] = 0;
          });

          for (const expense of expensesData) {
            // El pagador puso el dinero
            balanceMap[expense.paid_by] = (balanceMap[expense.paid_by] || 0) + Number(expense.amount);

            // Los splits indican cuánto debe cada uno
            const expenseSplits = (splitsData || []).filter(s => s.group_expense_id === expense.id);
            for (const split of expenseSplits) {
              balanceMap[split.user_id] = (balanceMap[split.user_id] || 0) - Number(split.amount);
            }
          }

          // Simplificar deudas
          const debtors: { id: string; name: string; amount: number }[] = [];
          const creditors: { id: string; name: string; amount: number }[] = [];

          for (const [userId, balance] of Object.entries(balanceMap)) {
            if (balance < -0.01) {
              debtors.push({ id: userId, name: memberMap[userId], amount: Math.abs(balance) });
            } else if (balance > 0.01) {
              creditors.push({ id: userId, name: memberMap[userId], amount: balance });
            }
          }

          debtors.sort((a, b) => b.amount - a.amount);
          creditors.sort((a, b) => b.amount - a.amount);

          const simplifiedDebts: Debt[] = [];
          let i = 0, j = 0;

          while (i < debtors.length && j < creditors.length) {
            const payment = Math.min(debtors[i].amount, creditors[j].amount);
            if (payment > 0.01) {
              simplifiedDebts.push({
                from: debtors[i].id,
                fromName: debtors[i].name,
                to: creditors[j].id,
                toName: creditors[j].name,
                amount: Math.round(payment * 100) / 100,
              });
            }
            debtors[i].amount -= payment;
            creditors[j].amount -= payment;
            if (debtors[i].amount < 0.01) i++;
            if (creditors[j].amount < 0.01) j++;
          }

          setDebts(simplifiedDebts);
        }

        setLoading(false);
      };
      fetchData();
    }, [groupId])
  );

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const handleCopyCode = async () => {
    if (group?.invite_code) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert('¡Copiado!', `Código: ${group.invite_code}`);
    }
  };

  const handleShareCode = async () => {
    if (group?.invite_code) {
      await Share.share({
        message: `¡Únete a mi grupo "${group.name}" en Numo! Código: ${group.invite_code}`,
      });
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Salir del grupo',
      '¿Estás seguro de que quieres abandonar este grupo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('group_members')
              .delete()
              .eq('group_id', groupId)
              .eq('user_id', currentUserId);

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

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => navigation.navigate('AddGroupExpense', { groupId, members })}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.addExpenseText}>Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* INFO GRUPO */}
        <View style={styles.groupHeader}>
          <Text style={styles.groupEmoji}>{group.emoji || '👥'}</Text>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMembers}>
            {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
          </Text>
        </View>

        {/* CÓDIGO DE INVITACIÓN */}
        <View style={styles.codeCard}>
          <View style={styles.codeRow}>
            <View>
              <Text style={styles.codeLabel}>Código de invitación</Text>
              <Text style={styles.codeValue}>{group.invite_code}</Text>
            </View>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
                <Copy size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.codeBtn} onPress={handleShareCode}>
                <Text style={styles.shareText}>Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* MIEMBROS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Miembros</Text>
          <View style={styles.card}>
            {members.map((m, index) => (
              <View key={m.user_id} style={[styles.memberRow, index < members.length - 1 && styles.border]}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {(m.profiles as any).first_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={styles.memberName}>
                  {(m.profiles as any).first_name} {(m.profiles as any).last_name}
                  {m.user_id === currentUserId ? ' (tú)' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* QUIÉN DEBE A QUIÉN */}
        {debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Balances</Text>
            <View style={styles.card}>
              {debts.map((debt, index) => (
                <View key={index} style={[styles.debtRow, index < debts.length - 1 && styles.border]}>
                  <View style={styles.debtInfo}>
                    <Text style={styles.debtFrom}>
                      {debt.from === currentUserId ? 'Tú debes' : `${debt.fromName.split(' ')[0]} debe`}
                    </Text>
                    <Text style={styles.debtTo}>
                      a {debt.to === currentUserId ? 'ti' : debt.toName.split(' ')[0]}
                    </Text>
                  </View>
                  <Text style={[
                    styles.debtAmount,
                    { color: debt.from === currentUserId ? Colors.negative : Colors.positive }
                  ]}>
                    {formatMoney(debt.amount)}€
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* GASTOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gastos del grupo</Text>
            {totalExpenses > 0 && (
              <Text style={styles.totalExpenses}>Total: {formatMoney(totalExpenses)}€</Text>
            )}
          </View>
          {expenses.length > 0 ? (
            <View style={styles.card}>
              {expenses.map((expense, index) => (
                <View key={expense.id} style={[styles.expenseRow, index < expenses.length - 1 && styles.border]}>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName}>{expense.description}</Text>
                    <Text style={styles.expensePayer}>
                      Pagado por {expense.paid_by === currentUserId ? 'ti' : expense.payer_name.split(' ')[0]} · {formatDate(expense.date)}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>{formatMoney(Number(expense.amount))}€</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyText}>Sin gastos aún</Text>
              <Text style={styles.emptySub}>Añade el primer gasto compartido del grupo</Text>
            </View>
          )}
        </View>

        {/* SALIR DEL GRUPO */}
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
          <LogOut size={18} color={Colors.negative} />
          <Text style={styles.leaveText}>Salir del grupo</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  addExpenseText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  groupHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  groupEmoji: { fontSize: 56, marginBottom: Spacing.xs },
  groupName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  groupMembers: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  codeCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  codeValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary, letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: Spacing.sm },
  codeBtn: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  shareText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  totalExpenses: { fontSize: FontSize.sm, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  memberInitial: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  memberName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  debtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  debtInfo: { flex: 1 },
  debtFrom: { fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  debtTo: { fontSize: FontSize.xs, color: Colors.textSecondary },
  debtAmount: { fontSize: FontSize.md, fontWeight: '700' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  expensePayer: { fontSize: FontSize.xs, color: Colors.textSecondary },
  expenseAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
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
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  leaveText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.negative, marginLeft: Spacing.xs },
});