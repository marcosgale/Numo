import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { CANONICAL_CAT_KEY } from '../data/categories';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  user_id: string | null;
};

const COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#54A0FF', '#5F27CD', '#FF9FF3',
  '#576574', '#C8D6E5', '#1DB87A', '#FF453A',
];

const EMOJIS = [
  '🍔', '🚗', '🏠', '✈️', '💊', '🎓', '🎮', '👕',
  '💇', '🛒', '📱', '💡', '🎵', '⚽', '📚', '💰',
  '💼', '🎁', '🍕', '☕', '🚌', '🏋️', '🎬', '🐾',
];

export default function CategoriesScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const translateCatName = (name: string) => {
    const key = CANONICAL_CAT_KEY[name.toLowerCase()];
    if (!key) return name;
    return (t.planner.items as Record<string, string>)[key] ?? name;
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [modalVisible, setModalVisible] = useState(false);

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🛒');
  const [newColor, setNewColor] = useState('#1DB87A');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchCategories = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('name');

        if (data) setCategories(data as Category[]);
        setLoading(false);
      };
      fetchCategories();
    }, [])
  );

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert(t.common.error, t.categories.errors.noName);
      return;
    }

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const isDuplicate = categories.some(
      c => c.type === newType && normalize(c.name) === normalize(newName.trim())
    );
    if (isDuplicate) {
      Alert.alert(t.common.error, t.categories.errors.duplicate);
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase.from('categories').insert({
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
      type: newType,
      user_id: user.id,
    }).select().single();

    setSaving(false);

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      setCategories(prev => [...prev, data as Category]);
      setModalVisible(false);
      setNewName('');
      setNewIcon('🛒');
      setNewColor('#1DB87A');
    }
  };

  const handleDelete = (cat: Category) => {
    if (!cat.user_id) {
      Alert.alert(t.categories.cannotDelete, t.categories.cannotDeleteMsg);
      return;
    }
    Alert.alert(
      t.categories.deleteTitle,
      t.categories.deleteMsg(translateCatName(cat.name)),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await supabase.from('categories').delete().eq('id', cat.id);
            setCategories(prev => prev.filter(c => c.id !== cat.id));
          },
        },
      ]
    );
  };

  const filtered = categories.filter(c => c.type === tab);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.categories.title}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setNewType(tab); setModalVisible(true); }}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsBar}>
        {(['expense', 'income'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.tab, tab === type && styles.tabActive]}
            onPress={() => setTab(type)}
          >
            <Text style={[styles.tabText, tab === type && styles.tabTextActive]}>
              {type === 'expense' ? t.categories.expenseTab : t.categories.incomeTab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📂</Text>
              <Text style={styles.emptyText}>{t.categories.emptyText}</Text>
              <Text style={styles.emptySub}>{t.categories.emptySub}</Text>
            </View>
          ) : (
            filtered.map(cat => (
              <View key={cat.id} style={styles.catRow}>
                <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
                  <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                </View>
                <Text style={styles.catName}>{translateCatName(cat.name)}</Text>
                {cat.user_id && (
                  <TouchableOpacity onPress={() => handleDelete(cat)} style={styles.deleteBtn}>
                    <Trash2 size={16} color={Colors.negative} />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t.categories.newCategory}</Text>

            <Text style={styles.fieldLabel}>{t.categories.name}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.categories.namePlaceholder}
              placeholderTextColor={Colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>{t.categories.type}</Text>
            <View style={styles.typeRow}>
              {(['expense', 'income'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, newType === type && styles.typeChipActive]}
                  onPress={() => setNewType(type)}
                >
                  <Text style={[styles.typeText, newType === type && styles.typeTextActive]}>
                    {type === 'expense' ? t.categories.expenseType : t.categories.incomeType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t.categories.icon}</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiChip, newIcon === e && styles.emojiChipActive]}
                  onPress={() => setNewIcon(e)}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t.categories.color}</Text>
            <View style={styles.colorGrid}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotActive]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>

            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveText}>{t.categories.create}</Text>
                }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  tab: { flex: 1, paddingBottom: Spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary, marginBottom: -1 },
  tabText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  catName: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  deleteBtn: { padding: 4 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip: {
    flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md,
    alignItems: 'center', backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  typeTextActive: { color: '#fff' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  emojiChip: {
    width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: 'transparent',
  },
  emojiChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md,
    alignItems: 'center', backgroundColor: Colors.border + '40',
  },
  cancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md,
    alignItems: 'center', backgroundColor: Colors.primary,
  },
  saveText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});
