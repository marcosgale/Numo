import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, FlatList } from 'react-native';
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

type UnclaimedMember = {
  id: string;
  display_name: string;
};

export default function GroupsScreen() {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const navigation = useNavigation<any>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Join modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Claim modal (shown when unclaimed slots exist)
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<{ id: string; name: string } | null>(null);
  const [unclaimedMembers, setUnclaimedMembers] = useState<UnclaimedMember[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

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

    // Already a member?
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

    // Check for unclaimed placeholder slots
    const { data: unclaimed } = await supabase
      .from('group_members')
      .select('id, display_name')
      .eq('group_id', group.id)
      .eq('is_claimed', false);

    setJoining(false);
    setJoinModalVisible(false);
    setJoinCode('');

    if (unclaimed && unclaimed.length > 0) {
      setPendingGroup(group);
      setUnclaimedMembers(unclaimed);
      setClaimModalVisible(true);
    } else {
      await joinGroupFresh(group.id, group.name, user.id);
    }
  };

  const joinGroupFresh = async (groupId: string, groupName: string, userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single();

    const displayName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : 'Member';

    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: userId,
      display_name: displayName,
      is_claimed: true,
    });

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      Alert.alert(t.groups.joined, t.groups.joinedMsg(groupName));
    }
  };

  const handleClaimSlot = async (memberId: string) => {
    if (!pendingGroup) return;
    setClaiming(memberId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClaiming(null); return; }

    const { error } = await supabase
      .from('group_members')
      .update({ user_id: user.id, is_claimed: true })
      .eq('id', memberId);

    setClaiming(null);

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      setClaimModalVisible(false);
      setPendingGroup(null);
      Alert.alert(t.groups.joined, t.groups.joinedMsg(pendingGroup.name));
    }
  };

  const handleJoinFresh = async () => {
    if (!pendingGroup) return;
    setClaiming('fresh');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClaiming(null); return; }

    setClaimModalVisible(false);
    await joinGroupFresh(pendingGroup.id, pendingGroup.name, user.id);
    setClaiming(null);
    setPendingGroup(null);
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

      {/* JOIN MODAL */}
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

      {/* CLAIM MODAL */}
      <Modal
        visible={claimModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClaimModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.claimSheet}>
            <Text style={styles.modalTitle}>{t.groups.claimTitle}</Text>
            <Text style={styles.modalSub}>{t.groups.claimSub}</Text>

            <FlatList
              data={unclaimedMembers}
              keyExtractor={item => item.id}
              style={styles.claimList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.claimRow, claiming === item.id && { opacity: 0.6 }]}
                  onPress={() => handleClaimSlot(item.id)}
                  disabled={!!claiming}
                  activeOpacity={0.7}
                >
                  <View style={styles.claimAvatar}>
                    <Text style={styles.claimAvatarText}>{item.display_name[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={styles.claimName}>{item.display_name}</Text>
                  {claiming === item.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.claimBtn}>{t.groups.claimBtn}</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            />

            <TouchableOpacity
              style={[styles.joinFreshBtn, claiming === 'fresh' && { opacity: 0.6 }]}
              onPress={handleJoinFresh}
              disabled={!!claiming}
            >
              <Text style={styles.joinFreshText}>{t.groups.joinFresh}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => { setClaimModalVisible(false); setPendingGroup(null); }}
            >
              <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
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
  claimSheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '80%',
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
    marginTop: Spacing.sm,
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
  claimList: { maxHeight: 280, marginBottom: Spacing.sm },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  claimAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  claimName: { flex: 1, fontSize: FontSize.md, fontWeight: '500', color: Colors.textPrimary },
  claimBtn: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  joinFreshBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  joinFreshText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
});
