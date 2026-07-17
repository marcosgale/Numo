import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

type Group = {
  id: string;
  name: string;
  emoji: string | null;
  currency: string;
  memberCount: number;
};

export default function SelectGroupScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
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
        .select('id, name, emoji, currency')
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
            currency: group.currency || 'EUR',
            memberCount: count || 0,
          });
        }
        setGroups(groupsWithCount);
      }

      setLoading(false);
    };
    fetchGroups();
  }, []);

  const handleSelectGroup = async (group: Group) => {
    setSelecting(group.id);

    const { data: membersData } = await supabase
      .from('group_members')
      .select('id, user_id, display_name, is_claimed')
      .eq('group_id', group.id);

    setSelecting(null);

    if (!membersData) {
      Alert.alert(t.common.error, t.selectGroup.loadError);
      return;
    }

    const members = membersData.map((m: any) => ({
      id: m.id,
      user_id: m.user_id ?? null,
      display_name: m.display_name || '',
      is_claimed: m.is_claimed ?? true,
    }));

    navigation.replace('AddGroupExpense', {
      groupId: group.id,
      members,
      groupCurrency: group.currency,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.selectGroup.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>{t.selectGroup.noGroups}</Text>
          <Text style={styles.emptySub}>{t.selectGroup.noGroupsSub}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>{t.selectGroup.subtitle}</Text>
          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => handleSelectGroup(group)}
              disabled={!!selecting}
              activeOpacity={0.7}
            >
              <Text style={styles.groupEmoji}>{group.emoji || '👥'}</Text>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  {group.memberCount} {group.memberCount === 1 ? t.groups.member : t.groups.members} · {group.currency}
                </Text>
              </View>
              {selecting === group.id ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.arrow}>›</Text>
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
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
  groupMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  arrow: { fontSize: 22, color: Colors.textSecondary },
});
