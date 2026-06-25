import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

const EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🏖️', '🎮', '🎸', '🏋️', '📚', '🎁', '💰', '🌍'];

export default function AddGoalScreen({ route, navigation }: any) {
  const goal = route.params?.goal;
  const isEditing = !!goal;

  const [name, setName] = useState(isEditing ? goal.name : '');
  const [description, setDescription] = useState(isEditing ? (goal.description || '') : '');
  const [targetAmount, setTargetAmount] = useState(isEditing ? String(goal.target_amount) : '');
  const [emoji, setEmoji] = useState(isEditing ? (goal.emoji || '🎯') : '🎯');
  const [deadline, setDeadline] = useState(isEditing && goal.deadline ? formatDateToDisplay(goal.deadline) : '');
  const [loading, setLoading] = useState(false);

  function formatDateToDisplay(isoDate: string): string {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const formatDeadline = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  };

  const parseDeadline = (dateString: string): string | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return targetAmount;
    if (parts[1]?.length > 2) return targetAmount;
    return cleaned;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Dale un nombre a tu meta');
      return;
    }
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      Alert.alert('Error', 'Introduce una cantidad objetivo');
      return;
    }
    if (deadline && !parseDeadline(deadline)) {
      Alert.alert('Error', 'Formato de fecha inválido (DD/MM/YYYY)');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'No hay sesión activa');
      setLoading(false);
      return;
    }

    const goalData = {
      name: name.trim(),
      description: description.trim() || null,
      target_amount: parseFloat(targetAmount),
      deadline: parseDeadline(deadline),
      emoji: emoji,
    };

    let error;

    if (isEditing) {
      ({ error } = await supabase
        .from('goals')
        .update(goalData)
        .eq('id', goal.id));
    } else {
      ({ error } = await supabase.from('goals').insert({
        ...goalData,
        user_id: user.id,
        current_amount: 0,
      }));
    }

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        isEditing ? '¡Meta actualizada!' : '¡Meta creada!',
        isEditing ? '' : 'Ya puedes empezar a ahorrar',
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
          <Text style={styles.headerTitle}>{isEditing ? 'Editar meta' : 'Nueva meta'}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* NOMBRE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nombre de la meta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Viaje a Japón, Coche nuevo..."
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditing}
            />
          </View>

          {/* DESCRIPCIÓN */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Dos semanas por Tokio, Osaka y Kioto"
              placeholderTextColor={Colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* CANTIDAD OBJETIVO */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>¿Cuánto necesitas?</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={targetAmount}
                onChangeText={(text) => setTargetAmount(formatAmount(text))}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountCurrency}>€</Text>
            </View>
          </View>

          {/* EMOJI */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Elige un icono</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* FECHA LÍMITE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fecha límite (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={Colors.textSecondary}
              value={deadline}
              onChangeText={(text) => setDeadline(formatDeadline(text))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* BOTÓN */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear meta'}
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
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountCurrency: { fontSize: 32, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.sm },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  emojiText: { fontSize: 24 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});