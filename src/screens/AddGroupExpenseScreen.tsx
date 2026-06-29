import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

type Member = {
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
};

export default function AddGroupExpenseScreen({ route, navigation }: any) {
  const { groupId, members } = route.params;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [splitEqually, setSplitEqually] = useState(true);
  const [customSplits, setCustomSplits] = useState<{ [userId: string]: string }>({});
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    members.map((m: Member) => m.user_id)
  );
  const [loading, setLoading] = useState(false);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return amount;
    if (parts[1]?.length > 2) return amount;
    return cleaned;
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getEqualSplit = () => {
    if (!amount || selectedMembers.length === 0) return 0;
    return Math.round((parseFloat(amount) / selectedMembers.length) * 100) / 100;
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Introduce un importe válido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Añade una descripción');
      return;
    }
    if (selectedMembers.length < 2) {
      Alert.alert('Error', 'Selecciona al menos 2 personas para dividir');
      return;
    }

    // Validar splits custom
    if (!splitEqually) {
      const totalCustom = Object.values(customSplits)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const diff = Math.abs(totalCustom - parseFloat(amount));
      if (diff > 0.02) {
        Alert.alert('Error', `Los importes no suman el total. Diferencia: ${diff.toFixed(2)}€`);
        return;
      }
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Crear gasto grupal
    const { data: expense, error: expenseError } = await supabase
      .from('group_expenses')
      .insert({
        group_id: groupId,
        paid_by: user.id,
        amount: parseFloat(amount),
        description: description.trim(),
        date: today,
      })
      .select('id')
      .single();

    if (expenseError || !expense) {
      setLoading(false);
      Alert.alert('Error', expenseError?.message || 'Error al crear el gasto');
      return;
    }

    // Crear splits
    const splits = selectedMembers.map(userId => ({
      group_expense_id: expense.id,
      user_id: userId,
      amount: splitEqually
        ? getEqualSplit()
        : parseFloat(customSplits[userId] || '0'),
      is_paid: userId === user.id,
    }));

    const { error: splitError } = await supabase
      .from('group_expense_splits')
      .insert(splits);

    setLoading(false);

    if (splitError) {
      Alert.alert('Error', splitError.message);
    } else {
      Alert.alert(
        '¡Gasto añadido!',
        `${formatMoney(parseFloat(amount))}€ dividido entre ${selectedMembers.length} personas`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo gasto compartido</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* IMPORTE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Importe total</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={amount}
                onChangeText={(text) => setAmount(formatAmount(text))}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.amountCurrency}>€</Text>
            </View>
          </View>

          {/* DESCRIPCIÓN */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>¿Qué habéis pagado?</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Cena, supermercado, Airbnb..."
              placeholderTextColor={Colors.textSecondary}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* TIPO DE DIVISIÓN */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Dividir a partes iguales</Text>
            <Switch
              value={splitEqually}
              onValueChange={setSplitEqually}
              trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
              thumbColor={splitEqually ? Colors.primary : '#f4f3f4'}
            />
          </View>

          {/* MIEMBROS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>¿Entre quiénes?</Text>
            <View style={styles.card}>
              {members.map((m: Member, index: number) => {
                const isSelected = selectedMembers.includes(m.user_id);
                const memberName = `${(m.profiles as any).first_name} ${(m.profiles as any).last_name}`;

                return (
                  <View key={m.user_id} style={[styles.memberRow, index < members.length - 1 && styles.borderBottom]}>
                    <TouchableOpacity
                      style={styles.memberCheck}
                      onPress={() => toggleMember(m.user_id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.memberName}>{memberName}</Text>
                    </TouchableOpacity>

                    {!splitEqually && isSelected && (
                      <View style={styles.customSplitInput}>
                        <TextInput
                          style={styles.splitInput}
                          placeholder="0.00"
                          placeholderTextColor={Colors.textSecondary}
                          value={customSplits[m.user_id] || ''}
                          onChangeText={(text) => {
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            setCustomSplits(prev => ({ ...prev, [m.user_id]: cleaned }));
                          }}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.splitCurrency}>€</Text>
                      </View>
                    )}

                    {splitEqually && isSelected && amount && parseFloat(amount) > 0 && (
                      <Text style={styles.equalAmount}>{formatMoney(getEqualSplit())}€</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* BOTÓN */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : 'Añadir gasto'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  container: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
  },
  amountCurrency: { fontSize: 48, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberCheck: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  memberName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  equalAmount: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  customSplitInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
  },
  splitInput: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: Spacing.xs,
    width: 70,
    textAlign: 'right',
  },
  splitCurrency: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});