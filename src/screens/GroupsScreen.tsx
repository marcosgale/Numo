import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
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
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
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
            groupsWithCount.push({ ...group, memberCount: count || 0 });
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
      Alert.alert(t.common.error, t.groups.errors.invalidCode);
      return;
    }

    setJoining(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setJoining(false); return; }

    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .single();

    if (!group) {
      setJoining(false);
      Alert.alert(t.common.error, t.groups.errors.notFound);
      return;
    }

    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      setJoining(false);
      Alert.alert('Info', t.groups.errors.alreadyMember);
      setJoinModalVisible(false);
      setJoinCode('');
      return;
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    });

    setJoining(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(t.groups.joined, t.groups.joinedMsg(group.name), [
        { text: 'OK', onPress: () => { setJoinModalVisible(false); setJoinCode(''); } },
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
          <Text style={styles.headerTitle}>{t.groups.title}</Text>
        </View>

        {groups.length > 0 ? (
          <>
            {groups.map((group) => (
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
                    {group.memberCount} {group.memberCount === 1 ? t.groups.member : t.groups.members}
                  </Text>
                </View>
                <Text style={styles.groupArrow}>›</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.actionsSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={styles.actionButtonText}>{t.groups.createGroup}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonOutline}
                onPress={() => setJoinModalVisible(true)}
              >
                <Text style={styles.actionButtonOutlineText}>{t.groups.joinWithCode}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>{t.groups.emptyTitle}</Text>
            <Text style={styles.emptySub}>{t.groups.emptySub}</Text>
            <View style={styles.emptyButtons}>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Text style={styles.emptyButtonText}>{t.groups.createGroupBtn}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyButton, styles.emptyButtonOutline]}
                onPress={() => setJoinModalVisible(true)}
              >
                <Text style={[styles.emptyButtonText, { color: Colors.primary }]}>{t.groups.joinBtn}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t.groups.joinGroupTitle}</Text>
            <Text style={styles.modalSub}>{t.groups.joinGroupSub}</Text>
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
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalJoin, joining && { opacity: 0.6 }]}
                onPress={handleJoinGroup}
                disabled={joining}
              >
                <Text style={styles.modalJoinText}>{joining ? t.groups.joining : t.groups.join}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
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
  groupArrow: { fontSize: 22, color: Colors.textSecondary },
  actionsSection: { marginTop: Spacing.lg, gap: Spacing.sm },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  actionButtonOutlineText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
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
