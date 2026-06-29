import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Keyboard, TouchableWithoutFeedback, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

const EMOJIS = ['👥', '🏠', '✈️', '🍽️', '🎉', '🏋️', '🎓', '💼', '🎮', '🏖️', '🚗', '❤️', '🎵', '⚽', '🛒', '🍕'];

const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function CreateGroupScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Dale un nombre al grupo');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const inviteCode = generateCode();

    // Crear grupo
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        emoji: emoji,
        created_by: user.id,
        invite_code: inviteCode,
      })
      .select('id')
      .single();

    if (groupError) {
      setLoading(false);
      Alert.alert('Error', groupError.message);
      return;
    }

    // Añadirme como miembro
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
      });

    setLoading(false);

    if (memberError) {
      Alert.alert('Error', memberError.message);
    } else {
      setCreatedCode(inviteCode);
    }
  };

  const handleCopyCode = async () => {
    if (createdCode) {
      await Clipboard.setStringAsync(createdCode);
      Alert.alert('¡Copiado!', 'Comparte este código con las personas que quieras invitar');
    }
  };

  // Pantalla de éxito con código
  if (createdCode) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>¡Grupo creado!</Text>
          <Text style={styles.successSub}>Comparte este código para que se unan tus amigos</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeText}>{createdCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
              <Copy size={18} color={Colors.primary} />
              <Text style={styles.copyText}>Copiar código</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Ir al grupo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo grupo</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
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

          {/* NOMBRE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nombre del grupo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Piso Madrid, Viaje Ibiza, Trabajo..."
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* BOTÓN */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creando...' : 'Crear grupo'}
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
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  successEmoji: { fontSize: 64, marginBottom: Spacing.md },
  successTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  successSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  copyText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  doneButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});