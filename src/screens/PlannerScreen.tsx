import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, X, Plus } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

// ── Defaults ──────────────────────────────────────────────────────────────────
// `es` is the canonical name used to match/create categories in Supabase.
// Display name comes from t.planner.items[key].
const PLAN_DEFAULTS = [
  { key: 'vivienda',     es: 'Vivienda',     icon: '🏠', color: '#54A0FF' },
  { key: 'alimentacion', es: 'Alimentación', icon: '🍔', color: '#FF9F43' },
  { key: 'transporte',   es: 'Transporte',   icon: '🚗', color: '#FECA57' },
  { key: 'ocio',         es: 'Ocio',         icon: '🎮', color: '#5F27CD' },
  { key: 'compras',      es: 'Compras',      icon: '🛍️', color: '#FF9FF3' },
] as const;

type DefaultKey = typeof PLAN_DEFAULTS[number]['key'];

// ── Types ─────────────────────────────────────────────────────────────────────
type PlanItem = {
  uid: string;
  defaultKey?: DefaultKey;
  categoryId?: string;   // existing Supabase category ID
  displayName: string;   // what the user sees
  canonicalName: string; // stored in Supabase on create
  icon: string;
  color: string;
  amount: string;
};

type SupabaseCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type ExistingLimit = {
  id: string;
  category_id: string;
  amount: number;
  period: string;
};

type Period = 'monthly' | 'weekly' | 'daily';

let uidCounter = 0;
const uid = () => `plan_${++uidCounter}_${Date.now()}`;

// ── Component ─────────────────────────────────────────────────────────────────
const CANONICAL_CAT_KEY: Record<string, string> = {
  'vivienda': 'vivienda', 'alimentación': 'alimentacion', 'alimentacion': 'alimentacion',
  'transporte': 'transporte', 'facturas': 'facturas', 'ocio': 'ocio',
  'compras': 'compras', 'suscripciones': 'suscripciones', 'salud': 'salud',
  'ahorro': 'ahorro', 'hogar': 'hogar', 'educación': 'educacion', 'educacion': 'educacion',
  'otros': 'otros', 'restaurantes': 'restaurantes', 'ropa': 'ropa',
  'mascota': 'mascota', 'mascotas': 'mascota', 'deporte': 'deporte',
  'viaje': 'viaje', 'viajes': 'viaje', 'tecnología': 'tecnologia', 'tecnologia': 'tecnologia',
};

export default function PlannerScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);

  const translateCatName = (name: string) => {
    const key = CANONICAL_CAT_KEY[name.toLowerCase()];
    if (!key) return name;
    return (t.planner.items as Record<string, string>)[key] ?? name;
  };

  const [period, setPeriod] = useState<Period>('monthly');
  const [items, setItems] = useState<PlanItem[]>([]);
  const [allLimits, setAllLimits] = useState<ExistingLimit[]>([]);
  const [extraCategories, setExtraCategories] = useState<SupabaseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { loadData(); }, []);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: cats }, { data: limits }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('type', 'expense')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('limits')
        .select('id, category_id, amount, period')
        .eq('user_id', user.id),
    ]);

    const catList = (cats || []) as SupabaseCategory[];
    const limitList = (limits || []) as ExistingLimit[];

    setAllLimits(limitList);

    // Build default items, matching existing Supabase categories by name
    const defaultItems: PlanItem[] = PLAN_DEFAULTS.map(def => {
      const displayName = (t.planner.items as Record<string, string>)[def.key] ?? def.es;
      // Match: canonical Spanish name OR translated EN name
      const matched = catList.find(
        c => c.name.toLowerCase() === def.es.toLowerCase() ||
             c.name.toLowerCase() === displayName.toLowerCase()
      );
      // Pre-fill from monthly limits
      const existingLimit = limitList.find(
        l => l.period === 'monthly' && l.category_id === matched?.id
      );
      return {
        uid: uid(),
        defaultKey: def.key,
        categoryId: matched?.id,
        displayName,
        canonicalName: def.es,
        icon: matched?.icon ?? def.icon,
        color: matched?.color ?? def.color,
        amount: existingLimit ? String(existingLimit.amount) : '',
      };
    });

    setItems(defaultItems);

    // Extra categories = user's categories NOT covered by defaults
    const defaultNames = PLAN_DEFAULTS.map(d => d.es.toLowerCase());
    const defaultTranslated = PLAN_DEFAULTS.map(
      d => ((t.planner.items as Record<string, string>)[d.key] ?? d.es).toLowerCase()
    );
    const extras = catList.filter(
      c => !defaultNames.includes(c.name.toLowerCase()) &&
           !defaultTranslated.includes(c.name.toLowerCase())
    );
    setExtraCategories(extras);

    setLoading(false);
  };

  // ── Period change ─────────────────────────────────────────────────────────
  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    setItems(prev => prev.map(item => {
      const lim = allLimits.find(
        l => l.period === next && l.category_id === item.categoryId
      );
      return { ...item, amount: lim ? String(lim.amount) : '' };
    }));
  };

  // ── Amount helpers ────────────────────────────────────────────────────────
  const formatAmount = (text: string, prev: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return prev;
    if (parts[1]?.length > 2) return prev;
    return cleaned;
  };

  const formatMoney = (value: number) =>
    value.toLocaleString(t.dashboard.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalBudget = items.reduce((sum, item) => {
    const v = parseFloat(item.amount || '0');
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const filledCount = items.filter(item => {
    const v = parseFloat(item.amount || '0');
    return !isNaN(v) && v > 0;
  }).length;

  // ── Remove item ───────────────────────────────────────────────────────────
  const removeItem = (itemUid: string) => {
    setItems(prev => prev.filter(i => i.uid !== itemUid));
  };

  // ── Add from extra categories ─────────────────────────────────────────────
  const addExtraCategory = (cat: SupabaseCategory) => {
    const existingLimit = allLimits.find(
      l => l.period === period && l.category_id === cat.id
    );
    const newItem: PlanItem = {
      uid: uid(),
      categoryId: cat.id,
      displayName: translateCatName(cat.name),
      canonicalName: cat.name,
      icon: cat.icon,
      color: cat.color,
      amount: existingLimit ? String(existingLimit.amount) : '',
    };
    setItems(prev => [...prev, newItem]);
    setExtraCategories(prev => prev.filter(c => c.id !== cat.id));
    setShowAddModal(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = items.filter(item => {
      const v = parseFloat(item.amount || '0');
      return !isNaN(v) && v > 0;
    });

    if (toSave.length === 0) {
      Alert.alert(t.common.error, t.planner.noAmountAlert);
      return;
    }

    const existingToReplace = allLimits.filter(
      l => l.period === period && toSave.some(i => i.categoryId === l.category_id)
    );

    const doSave = async () => {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }

      // Resolve categoryIds — create missing categories
      const resolved: { categoryId: string; amount: number }[] = [];
      for (const item of toSave) {
        let catId = item.categoryId;

        if (!catId) {
          // Try to find by name first
          const { data: found } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', item.canonicalName)
            .maybeSingle();

          if (found) {
            catId = found.id;
          } else {
            // Create the category
            const { data: created } = await supabase
              .from('categories')
              .insert({
                user_id: user.id,
                name: item.canonicalName,
                icon: item.icon,
                color: item.color,
                type: 'expense',
              })
              .select('id')
              .single();
            catId = created?.id;
          }
        }

        if (catId) resolved.push({ categoryId: catId, amount: parseFloat(item.amount) });
      }

      // Delete existing limits for this period that will be replaced
      const toDeleteIds = allLimits
        .filter(l => l.period === period && resolved.some(r => r.categoryId === l.category_id))
        .map(l => l.id);

      if (toDeleteIds.length > 0) {
        await supabase.from('limits').delete().in('id', toDeleteIds);
      }

      // Insert new limits
      const { error } = await supabase.from('limits').insert(
        resolved.map(r => ({
          user_id: user.id,
          category_id: r.categoryId,
          amount: r.amount,
          period,
        }))
      );

      setSaving(false);

      if (error) {
        Alert.alert(t.common.error, error.message);
      } else {
        Alert.alert(t.planner.successTitle, t.planner.successMsg(resolved.length), [
          { text: t.common.ok, onPress: () => navigation.goBack() },
        ]);
      }
    };

    if (existingToReplace.length > 0) {
      Alert.alert(t.planner.replaceTitle, t.planner.replaceMsg(existingToReplace.length), [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.planner.replace, onPress: doSave },
      ]);
    } else {
      doSave();
    }
  };

  // ── Periods config ────────────────────────────────────────────────────────
  const PERIODS: { key: Period; label: string; desc: string }[] = [
    { key: 'monthly', label: t.planner.periods.monthly, desc: t.planner.periodDesc.monthly },
    { key: 'weekly',  label: t.planner.periods.weekly,  desc: t.planner.periodDesc.weekly  },
    { key: 'daily',   label: t.planner.periods.daily,   desc: t.planner.periodDesc.daily   },
  ];

  // ── Already added IDs (for "add more" modal filter) ───────────────────────
  const addedCategoryIds = new Set(items.map(i => i.categoryId).filter(Boolean));
  const availableExtras = extraCategories.filter(c => !addedCategoryIds.has(c.id));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.planner.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Period selector */}
            <View style={styles.periodRow}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, period === p.key && styles.periodChipActive]}
                  onPress={() => handlePeriodChange(p.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodLabel, period === p.key && styles.periodLabelActive]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.periodDesc, period === p.key && styles.periodDescActive]}>
                    {p.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Total budget card */}
            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>{t.planner.totalBudget}</Text>
                <Text style={styles.totalAmount}>{formatMoney(totalBudget)} €</Text>
              </View>
              <View style={[styles.countBadge, filledCount > 0 && styles.countBadgeActive]}>
                <Text style={[styles.countText, filledCount > 0 && styles.countTextActive]}>
                  {t.planner.categories(filledCount)}
                </Text>
              </View>
            </View>

            {/* Category rows */}
            <View style={styles.catCard}>
              {items.map((item, index) => {
                const filled = parseFloat(item.amount || '0') > 0;
                return (
                  <View key={item.uid} style={[styles.catRow, index > 0 && styles.catRowBorder]}>
                    {/* Remove button */}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeItem(item.uid)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Icon */}
                    <View style={[styles.catIcon, { backgroundColor: item.color + '20' }]}>
                      <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                    </View>

                    {/* Name */}
                    <Text style={styles.catName} numberOfLines={1}>{item.displayName}</Text>

                    {/* Amount input */}
                    <TextInput
                      style={[styles.amountInput, filled && styles.amountInputFilled]}
                      value={item.amount}
                      onChangeText={text => {
                        const formatted = formatAmount(text, item.amount);
                        setItems(prev => prev.map(i =>
                          i.uid === item.uid ? { ...i, amount: formatted } : i
                        ));
                      }}
                      placeholder="0"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      selectTextOnFocus
                    />
                    <Text style={styles.suffix}>€</Text>
                  </View>
                );
              })}
            </View>

            {/* Add more button */}
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.addMoreText}>{t.planner.addMore}</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Sticky bottom save button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || filledCount === 0) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || filledCount === 0}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText} numberOfLines={1}>
                    {t.planner.activateBtn(filledCount, formatMoney(totalBudget))}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Add more categories modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.planner.addMoreTitle}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {availableExtras.length === 0 ? (
              <Text style={styles.modalEmpty}>{t.planner.addMoreEmpty}</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {availableExtras.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.modalRow, i > 0 && styles.modalRowBorder]}
                    onPress={() => addExtraCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
                      <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    </View>
                    <Text style={styles.modalCatName}>{translateCatName(cat.name)}</Text>
                    <Plus size={18} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (Colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },

  // Period
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  periodChip: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  periodChipActive: { backgroundColor: Colors.primary + '12', borderColor: Colors.primary },
  periodLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  periodLabelActive: { color: Colors.primary },
  periodDesc: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  periodDescActive: { color: Colors.primary + 'BB' },

  // Total card
  totalCard: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: Colors.primary, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  totalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: '600', letterSpacing: 0.4 },
  totalAmount: { fontSize: 26, fontWeight: '700', color: '#fff' },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  countTextActive: { color: '#fff' },

  // Category list card
  catCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    overflow: 'hidden', marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    gap: 8,
  },
  catRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  removeBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  catIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catName: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  amountInput: {
    width: 80, textAlign: 'right',
    fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary,
    paddingVertical: 5, paddingHorizontal: 6,
    backgroundColor: Colors.background, borderRadius: BorderRadius.sm,
  },
  amountInputFilled: { color: Colors.textPrimary },
  suffix: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, width: 14 },

  // Add more button
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary + '50',
    borderRadius: BorderRadius.lg, borderStyle: 'dashed',
    marginBottom: Spacing.sm,
  },
  addMoreText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalEmpty: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.lg },
  modalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.md,
  },
  modalRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  modalCatName: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
});
