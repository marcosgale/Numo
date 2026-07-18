import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Share, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Copy, LogOut } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

type Member = {
  id: string;
  user_id: string | null;
  display_name: string;
  is_claimed: boolean;
};

type Split = {
  memberId: string;
  name: string;
  amount: number;
  is_paid: boolean;
};

type GroupExpense = {
  id: string;
  amount: number;
  base_amount: number;
  description: string;
  date: string;
  paid_by_member_id: string;
  payer_name: string;
  currency: string;
  splits: Split[];
};

type MemberBalance = {
  memberId: string;
  name: string;
  balance: number;
};

type Debt = {
  from: string;
  fromName: string;
  fromUserId: string | null;
  to: string;
  toName: string;
  toUserId: string | null;
  amount: number;
};

type Tab = 'gastos' | 'balances' | 'miembros';

export default function GroupDetailScreen({ route, navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const { groupId } = route.params;
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [memberBalances, setMemberBalances] = useState<MemberBalance[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('gastos');
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [settling, setSettling] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: groupData } = await supabase
      .from('groups')
      .select('id, name, emoji, invite_code, created_by, currency')
      .eq('id', groupId)
      .single();

    if (groupData) setGroup(groupData);

    const { data: membersData } = await supabase
      .from('group_members')
      .select('id, user_id, display_name, is_claimed')
      .eq('group_id', groupId);

    const memberList: Member[] = (membersData || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      display_name: m.display_name || '',
      is_claimed: m.is_claimed,
    }));
    setMembers(memberList);

    const myMember = memberList.find(m => m.user_id === user.id);
    const myMemberId = myMember?.id || '';
    setCurrentMemberId(myMemberId);

    // memberId → display_name map
    const memberMap: { [id: string]: string } = {};
    memberList.forEach(m => { memberMap[m.id] = m.display_name; });

    // memberId → user_id map (for settlements)
    const memberUserMap: { [id: string]: string | null } = {};
    memberList.forEach(m => { memberUserMap[m.id] = m.user_id; });

    const { data: expensesData } = await supabase
      .from('group_expenses')
      .select('id, amount, base_amount, description, date, paid_by_member_id, currency')
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!expensesData || expensesData.length === 0) {
      setExpenses([]);
      setMemberBalances(memberList.map(m => ({
        memberId: m.id,
        name: m.display_name,
        balance: 0,
      })));
      setDebts([]);
      setLoading(false);
      return;
    }

    const { data: splitsData } = await supabase
      .from('group_expense_splits')
      .select('group_expense_id, member_id, amount, is_paid')
      .in('group_expense_id', expensesData.map(e => e.id));

    const expensesWithSplits: GroupExpense[] = expensesData.map(e => ({
      ...e,
      currency: e.currency || 'EUR',
      base_amount: Number(e.base_amount ?? e.amount),
      payer_name: memberMap[e.paid_by_member_id] || t.groupDetail.unknown,
      splits: (splitsData || [])
        .filter(s => s.group_expense_id === e.id)
        .map(s => ({
          memberId: s.member_id,
          name: memberMap[s.member_id] || t.groupDetail.unknown,
          amount: Number(s.amount),
          is_paid: s.is_paid,
        })),
    }));
    setExpenses(expensesWithSplits);

    // Balance calculation keyed by member.id
    const balanceMap: { [memberId: string]: number } = {};
    memberList.forEach(m => { balanceMap[m.id] = 0; });

    for (const expense of expensesData) {
      const expBaseAmount = Number(expense.base_amount ?? expense.amount);
      if (expense.paid_by_member_id) {
        balanceMap[expense.paid_by_member_id] = (balanceMap[expense.paid_by_member_id] || 0) + expBaseAmount;
      }

      const expenseSplits = (splitsData || []).filter(s => s.group_expense_id === expense.id);
      for (const split of expenseSplits) {
        const rawTotal = Number(expense.amount);
        const splitBase = rawTotal > 0
          ? (Number(split.amount) / rawTotal) * expBaseAmount
          : Number(split.amount);
        if (split.member_id) {
          balanceMap[split.member_id] = (balanceMap[split.member_id] || 0) - splitBase;
        }
      }
    }

    // Apply settlements
    const { data: settlementsData } = await supabase
      .from('group_settlements')
      .select('from_member_id, to_member_id, amount')
      .eq('group_id', groupId);

    if (settlementsData) {
      for (const s of settlementsData) {
        if (s.from_member_id) balanceMap[s.from_member_id] = (balanceMap[s.from_member_id] || 0) + Number(s.amount);
        if (s.to_member_id) balanceMap[s.to_member_id] = (balanceMap[s.to_member_id] || 0) - Number(s.amount);
      }
    }

    const balances: MemberBalance[] = Object.entries(balanceMap).map(([memberId, balance]) => {
      const rounded = Math.round(balance * 100) / 100;
      return {
        memberId,
        name: memberMap[memberId] || t.groupDetail.unknown,
        balance: Math.abs(rounded) <= 0.01 ? 0 : rounded,
      };
    });
    setMemberBalances(balances);

    // Simplify debts
    const debtors: { id: string; userId: string | null; name: string; amount: number }[] = [];
    const creditors: { id: string; userId: string | null; name: string; amount: number }[] = [];

    for (const { memberId, name, balance } of balances) {
      if (balance < -0.01) debtors.push({ id: memberId, userId: memberUserMap[memberId] ?? null, name, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ id: memberId, userId: memberUserMap[memberId] ?? null, name, amount: balance });
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
          fromUserId: debtors[i].userId,
          to: creditors[j].id,
          toName: creditors[j].name,
          toUserId: creditors[j].userId,
          amount: Math.round(payment * 100) / 100,
        });
      }
      debtors[i].amount -= payment;
      creditors[j].amount -= payment;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    setDebts(simplifiedDebts);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [groupId])
  );

  const formatMoney = (value: number) =>
    value.toLocaleString(t.groupDetail.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getCurrencySymbol = (code: string) => {
    const symbols: { [key: string]: string } = { EUR: '€', USD: '$', GBP: '£', CHF: 'Fr', JPY: '¥' };
    return symbols[code] || code;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString(t.groupDetail.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString(t.groupDetail.locale, { day: 'numeric', month: 'short' });
  };

  const displayName = (memberId: string, short = false) => {
    if (memberId === currentMemberId) return t.groupDetail.you;
    const member = members.find(m => m.id === memberId);
    const name = member?.display_name || t.groupDetail.unknown;
    return short ? name.split(' ')[0] : name;
  };

  const handleCopyCode = async () => {
    if (group?.invite_code) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert(t.common.copied, `${t.groupDetail.inviteCode}: ${group.invite_code}`);
    }
  };

  const handleShareCode = async () => {
    if (group?.invite_code) {
      await Share.share({
        message: t.groupDetail.shareGroupMsg(group.name, group.invite_code),
      });
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      t.groupDetail.leaveGroupTitle,
      t.groupDetail.leaveGroupMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.groupDetail.leave,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('group_members')
              .delete()
              .eq('group_id', groupId)
              .eq('user_id', currentUserId);
            if (error) Alert.alert(t.common.error, error.message);
            else navigation.goBack();
          },
        },
      ]
    );
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert(
      t.groupDetail.deleteExpense,
      t.groupDetail.deleteExpenseMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await supabase.from('group_expense_splits').delete().eq('group_expense_id', expenseId);
            const { error } = await supabase.from('group_expenses').delete().eq('id', expenseId);
            if (error) {
              Alert.alert(t.common.error, error.message);
            } else {
              setSelectedExpense(null);
              fetchData();
            }
          },
        },
      ]
    );
  };

  const handleSettle = (debt: Debt) => {
    Alert.alert(
      t.groupDetail.confirmPaymentTitle,
      t.groupDetail.confirmPaymentMsg(debt.fromName.split(' ')[0], formatMoney(debt.amount), groupCurrencySymbol),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          onPress: async () => {
            setSettling(true);
            const today = new Date().toISOString().split('T')[0];

            const { error } = await supabase.from('group_settlements').insert({
              group_id: groupId,
              from_member_id: debt.from,
              to_member_id: currentMemberId,
              from_user_id: debt.fromUserId || null,
              to_user_id: currentUserId || null,
              amount: debt.amount,
              currency: group?.currency || 'EUR',
              date: today,
            });

            setSettling(false);
            if (error) { Alert.alert(t.common.error, error.message); return; }

            await supabase.from('transactions').insert({
              user_id: currentUserId,
              type: 'income',
              amount: debt.amount,
              base_amount: debt.amount,
              currency: group?.currency || 'EUR',
              description: t.groupDetail.collectedFrom(debt.fromName.split(' ')[0]),
              date: today,
              is_recurring: false,
            });

            fetchData();
          },
        },
      ]
    );
  };

  const handleIPaid = (debt: Debt) => {
    Alert.alert(
      t.groupDetail.confirmIPaidTitle,
      t.groupDetail.confirmIPaidMsg(debt.toName.split(' ')[0], formatMoney(debt.amount), groupCurrencySymbol),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          onPress: async () => {
            setSettling(true);
            const today = new Date().toISOString().split('T')[0];

            const { error } = await supabase.from('group_settlements').insert({
              group_id: groupId,
              from_member_id: currentMemberId,
              to_member_id: debt.to,
              from_user_id: currentUserId || null,
              to_user_id: debt.toUserId || null,
              amount: debt.amount,
              currency: group?.currency || 'EUR',
              date: today,
            });

            setSettling(false);
            if (error) { Alert.alert(t.common.error, error.message); return; }

            await supabase.from('transactions').insert({
              user_id: currentUserId,
              type: 'expense',
              amount: debt.amount,
              base_amount: debt.amount,
              currency: group?.currency || 'EUR',
              description: t.groupDetail.paidTo(debt.toName.split(' ')[0]),
              date: today,
              is_recurring: false,
            });

            fetchData();
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

  const totalGroupExpenses = expenses.reduce((sum, e) => sum + Number(e.base_amount ?? e.amount), 0);
  const mySpent = expenses.reduce((sum, e) => {
    const mySplit = e.splits.find(s => s.memberId === currentMemberId);
    if (!mySplit) return sum;
    const rawTotal = Number(e.amount);
    const baseAmt = Number(e.base_amount ?? e.amount);
    const myBase = rawTotal > 0 ? (mySplit.amount / rawTotal) * baseAmt : mySplit.amount;
    return sum + myBase;
  }, 0);
  const groupCurrencySymbol = getCurrencySymbol(group.currency || 'EUR');

  const renderGastosTab = () => (
    <>
      {expenses.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.groupDetail.totalGroup}</Text>
            <Text style={styles.summaryValue}>{formatMoney(totalGroupExpenses)}{groupCurrencySymbol}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t.groupDetail.myPart}</Text>
            <Text style={styles.summaryValue}>{formatMoney(mySpent)}{groupCurrencySymbol}</Text>
          </View>
        </View>
      )}

      {expenses.length > 0 ? (
        <View style={styles.card}>
          {expenses.map((exp, index) => (
            <TouchableOpacity
              key={exp.id}
              style={[styles.expenseRow, index < expenses.length - 1 && styles.border]}
              onPress={() => setSelectedExpense(exp)}
              activeOpacity={0.6}
            >
              <View style={styles.expenseIconWrap}>
                <Text style={styles.expenseIcon}>🧾</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseName}>{exp.description}</Text>
                <Text style={styles.expenseMeta}>
                  {displayName(exp.paid_by_member_id, true)} · {formatDateShort(exp.date)}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>{formatMoney(Number(exp.amount))}{getCurrencySymbol(exp.currency)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🧾</Text>
          <Text style={styles.emptyText}>{t.groupDetail.noExpenses}</Text>
          <Text style={styles.emptySub}>{t.groupDetail.noExpensesSub}</Text>
        </View>
      )}
    </>
  );

  const renderBalancesTab = () => {
    const myBal = memberBalances.find(b => b.memberId === currentMemberId);

    return (
      <>
        {myBal && (
          <View style={[styles.myBalanceCard, {
            borderColor: myBal.balance > 0.01 ? Colors.positive : myBal.balance < -0.01 ? Colors.negative : Colors.border,
          }]}>
            <Text style={styles.myBalanceLabel}>{t.groupDetail.myBalance}</Text>
            <Text style={[styles.myBalanceAmount, {
              color: myBal.balance > 0.01 ? Colors.positive : myBal.balance < -0.01 ? Colors.negative : Colors.textSecondary,
            }]}>
              {myBal.balance >= 0 ? '+' : ''}{formatMoney(myBal.balance)}{groupCurrencySymbol}
            </Text>
            <Text style={styles.myBalanceSub}>
              {myBal.balance > 0.01
                ? t.groupDetail.owedToYou
                : myBal.balance < -0.01
                ? t.groupDetail.youOwe
                : t.groupDetail.upToDate}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          {memberBalances.map((mb, index) => (
            <View key={mb.memberId} style={[styles.balanceRow, index < memberBalances.length - 1 && styles.border]}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{mb.name[0]?.toUpperCase() || '?'}</Text>
              </View>
              <Text style={styles.balanceName}>
                {mb.memberId === currentMemberId ? t.groupDetail.you : mb.name.split(' ')[0]}
              </Text>
              <Text style={[
                styles.balanceAmount,
                { color: mb.balance > 0.01 ? Colors.positive : mb.balance < -0.01 ? Colors.negative : Colors.textSecondary }
              ]}>
                {mb.balance >= 0 ? '+' : ''}{formatMoney(mb.balance)}{groupCurrencySymbol}
              </Text>
            </View>
          ))}
        </View>

        {debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.groupDetail.whoPaysWho}</Text>
            <View style={styles.card}>
              {debts.map((debt, index) => (
                <View key={index} style={[styles.debtRow, index < debts.length - 1 && styles.border]}>
                  <View style={styles.debtInfo}>
                    <Text style={styles.debtText}>
                      {debt.to === currentMemberId ? (
                        <Text style={{ color: Colors.textPrimary }}>
                          {t.groupDetail.paysYou(debt.fromName.split(' ')[0])}
                        </Text>
                      ) : debt.from === currentMemberId ? (
                        <Text style={{ color: Colors.textPrimary }}>
                          {t.groupDetail.youPay(debt.toName.split(' ')[0])}
                        </Text>
                      ) : (
                        <>
                          <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                            {debt.fromName.split(' ')[0]}
                          </Text>
                          <Text style={{ color: Colors.textSecondary }}> → </Text>
                          <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                            {debt.toName.split(' ')[0]}
                          </Text>
                        </>
                      )}
                    </Text>
                    <Text style={styles.debtAmountSub}>
                      {formatMoney(debt.amount)}{groupCurrencySymbol}
                    </Text>
                  </View>
                  {debt.to === currentMemberId ? (
                    <TouchableOpacity
                      style={[styles.settleBtn, settling && { opacity: 0.5 }]}
                      onPress={() => handleSettle(debt)}
                      disabled={settling}
                    >
                      <Text style={styles.settleBtnText}>{t.groupDetail.settled}</Text>
                    </TouchableOpacity>
                  ) : debt.from === currentMemberId ? (
                    <TouchableOpacity
                      style={[styles.iPaidBtn, settling && { opacity: 0.5 }]}
                      onPress={() => handleIPaid(debt)}
                      disabled={settling}
                    >
                      <Text style={styles.iPaidBtnText}>{t.groupDetail.iPaid}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.debtAmount, { color: Colors.negative }]}>
                      {formatMoney(debt.amount)}{groupCurrencySymbol}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  const renderMiembrosTab = () => (
    <>
      <View style={styles.card}>
        {members.map((m, index) => (
          <View key={m.id} style={[styles.memberRow, index < members.length - 1 && styles.border]}>
            <View style={[styles.memberAvatar, !m.is_claimed && styles.memberAvatarPending]}>
              <Text style={styles.memberInitial}>{m.display_name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {m.display_name}
                {m.id === currentMemberId ? t.groupDetail.youSuffix : ''}
              </Text>
              {!m.is_claimed && (
                <Text style={styles.pendingLabel}>{t.groupDetail.pendingLabel}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>{t.groupDetail.inviteCode}</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeValue}>{group.invite_code}</Text>
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
              <Copy size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.codeBtn, { paddingHorizontal: Spacing.sm }]} onPress={handleShareCode}>
              <Text style={styles.shareText}>{t.groupDetail.share}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
        <LogOut size={18} color={Colors.negative} />
        <Text style={styles.leaveText}>{t.groupDetail.leaveGroup}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{group.emoji || '👥'}</Text>
          <Text style={styles.headerName} numberOfLines={1}>{group.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.addExpenseBtn}
          onPress={() => navigation.navigate('AddGroupExpense', {
            groupId,
            members,
            groupCurrency: group.currency || 'EUR',
          })}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'gastos' as Tab, label: t.groupDetail.tabs.expenses },
          { key: 'balances' as Tab, label: t.groupDetail.tabs.balances },
          { key: 'miembros' as Tab, label: t.groupDetail.tabs.members },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'gastos' && renderGastosTab()}
        {activeTab === 'balances' && renderBalancesTab()}
        {activeTab === 'miembros' && renderMiembrosTab()}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* EXPENSE DETAIL MODAL */}
      <Modal
        visible={!!selectedExpense}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExpense(null)}
      >
        {selectedExpense && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalExpenseName}>{selectedExpense.description}</Text>
              <Text style={styles.modalExpenseAmount}>{formatMoney(Number(selectedExpense.amount))}{getCurrencySymbol(selectedExpense.currency)}</Text>

              <View style={styles.modalMeta}>
                <Text style={styles.modalMetaText}>
                  {t.groupDetail.paidBy}{' '}
                  <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                    {displayName(selectedExpense.paid_by_member_id, true)}
                  </Text>
                </Text>
                <Text style={styles.modalMetaText}>{formatDate(selectedExpense.date)}</Text>
                {selectedExpense.currency !== (group?.currency || 'EUR') && (
                  <Text style={styles.modalConversionText}>
                    {t.groupDetail.conversionNote(formatMoney(selectedExpense.base_amount), getCurrencySymbol(group?.currency || 'EUR'))}
                  </Text>
                )}
              </View>

              {selectedExpense.splits.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t.groupDetail.participants}</Text>
                  <View style={styles.card}>
                    {selectedExpense.splits.map((split, i) => (
                      <View
                        key={split.memberId}
                        style={[styles.modalSplitRow, i < selectedExpense.splits.length - 1 && styles.border]}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberInitial}>{split.name[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <Text style={styles.modalSplitName}>
                          {displayName(split.memberId)}
                        </Text>
                        <Text style={styles.modalSplitAmount}>{formatMoney(split.amount)}{getCurrencySymbol(selectedExpense.currency)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalEditBtn}
                  onPress={() => {
                    setSelectedExpense(null);
                    navigation.navigate('AddGroupExpense', {
                      groupId,
                      members,
                      expense: selectedExpense,
                      groupCurrency: group.currency || 'EUR',
                    });
                  }}
                >
                  <Text style={styles.modalEditText}>{t.common.edit}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => handleDeleteExpense(selectedExpense.id)}
                >
                  <Text style={styles.modalDeleteText}>{t.common.delete}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedExpense(null)}
              >
                <Text style={styles.modalCloseText}>{t.common.close}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerEmoji: { fontSize: 22, marginRight: Spacing.xs },
  headerName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  addExpenseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  expenseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  expenseIcon: { fontSize: 18 },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  expenseMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
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
  myBalanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  myBalanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  myBalanceAmount: { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  myBalanceSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  balanceName: { flex: 1, fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  balanceAmount: { fontSize: FontSize.md, fontWeight: '700' },
  section: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  debtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  debtInfo: { flex: 1 },
  debtText: { fontSize: FontSize.md },
  debtAmountSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  debtAmount: { fontSize: FontSize.md, fontWeight: '700' },
  settleBtn: {
    backgroundColor: Colors.positive + '15',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  settleBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.positive },
  iPaidBtn: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  iPaidBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  memberAvatarPending: { backgroundColor: Colors.textSecondary + '60' },
  memberInitial: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  memberName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  pendingLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  codeCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary, letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: Spacing.sm },
  codeBtn: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.negative + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  leaveText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.negative, marginLeft: Spacing.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalExpenseName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalExpenseAmount: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalMeta: { marginBottom: Spacing.md },
  modalMetaText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  modalConversionText: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, fontWeight: '500' },
  modalSection: { marginBottom: Spacing.md },
  modalSectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  modalSplitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  modalSplitName: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  modalSplitAmount: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  modalEditBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  modalEditText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: Colors.negative + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  modalDeleteText: { color: Colors.negative, fontWeight: '700', fontSize: FontSize.md },
  modalCloseBtn: {
    backgroundColor: Colors.border + '60',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  modalCloseText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
});
