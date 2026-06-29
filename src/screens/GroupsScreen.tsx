import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, LogIn } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

type Group = {
  id: string;
  name: string;
  emoji: string | null;
  invite_code: string;
  memberCount: number;
};

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchGroups = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Grupos donde soy miembro
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (!memberships || memberships.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const groupIds = memberships.map(m => m.group_id);

        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name, emoji, invite_code')
          .in('id', groupIds);

        if (groupsData) {
          const groupsWithCount: Group[] = [];

          for (const group of groupsData) {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            groupsWithCount.push({
              ...group,
              memberCount: count || 0,
            });
          }

          setGroups(groupsWithCount);
        }

        setLoading(false);
      };
      fetchGroups();
    }, [])
  );

  const handleJoinGroup = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 6) {
      Alert.alert('Error', 'Introduce un código de 6 caracteres');
      return;
    }

    setJoining(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setJoining(false);
      return;
    }

    // Buscar grupo por código
    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .single();

    if (!group) {
      setJoining(false);
      Alert.alert('Error', 'No se encontró ningún grupo con ese código');
      return;
    }

    // Verificar si ya soy miembro
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      setJoining(false);
      Alert.alert('Info', 'Ya eres miembro de este grupo');
      setJoinModalVisible(false);
      setJoinCode('');
      return;
    }

    // Unirse
    const { error } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    });

    setJoining(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('¡Te has unido!', `Ahora eres miembro de "${group.name}"`, [
        {
          text: 'OK',
          onPress: () => {
            setJoinModalVisible(false);
            setJoinCode('');
          },
        },
      ]);
    }
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
          <Text style={styles.headerTitle}>Grupos</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setJoinModalVisible(true)}
            >
              <LogIn size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {groups.length > 0 ? (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
              activeOpacity={0.7}
            >
              <Text style={styles.groupEmoji}>{group.emoji || '👥'}</Text>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMembers}>
                  {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'}
                </Text>
              </View>
              <Text style={styles.groupArrow}>{'>'}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>Sin grupos</Text>
            <Text style={styles.emptySub}>Crea un grupo para compartir gastos con amigos o únete con un código</Text>
            <View style={styles.emptyButtons}>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={styles.emptyButtonText}>Crear grupo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyButton, styles.emptyButtonOutline]}
                onPress={() => setJoinModalVisible(true)}
              >
                <Text style={[styles.emptyButtonText, { color: Colors.primary }]}>Unirse con código</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* MODAL UNIRSE */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Unirse a un grupo</Text>
            <Text style={styles.modalSub}>Introduce el código de 6 caracteres que te han compartido</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="ABCDEF"
              placeholderTextColor={Colors.textSecondary}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setJoinModalVisible(false); setJoinCode(''); }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalJoin, joining && { opacity: 0.6 }]}
                onPress={handleJoinGroup}
                disabled={joining}
              >
                <Text style={styles.modalJoinText}>{joining ? 'Uniendo...' : 'Unirse'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupEmoji: { fontSize: 36, marginRight: Spacing.md },
  groupInfo: { flex: 1 },
  groupName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  groupMembers: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  groupArrow: { fontSize: FontSize.lg, color: Colors.textSecondary },
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
  emptyButtons: { width: '100%', gap: Spacing.sm },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  emptyButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  emptyButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  codeInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: Spacing.lg,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.border + '40',
  },
  modalCancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  modalJoin: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  modalJoinText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});