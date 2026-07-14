import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';

const PREFS_KEY = 'notification_prefs';

type Prefs = {
  dailySummary: boolean;
  limitAlerts: boolean;
  goalReminders: boolean;
  groupExpenses: boolean;
};

const DEFAULT_PREFS: Prefs = {
  dailySummary: true,
  limitAlerts: true,
  goalReminders: true,
  groupExpenses: true,
};

const PREF_KEYS: (keyof Prefs)[] = ['dailySummary', 'limitAlerts', 'goalReminders', 'groupExpenses'];

export default function NotificationsScreen({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const styles = makeStyles(Colors);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(saved => {
      if (saved) {
        try { setPrefs(JSON.parse(saved)); } catch {}
      }
    });
  }, []);

  const toggle = (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.notifications.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🔔</Text>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>{t.notifications.comingSoon}</Text>
            <Text style={styles.infoText}>{t.notifications.comingSoonDesc}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>{t.notifications.chooseTitle}</Text>

        <View style={styles.card}>
          {PREF_KEYS.map((key, i) => {
            const opt = t.notifications.options[i];
            return (
              <View key={key} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{opt.title}</Text>
                  <Text style={styles.rowDesc}>{opt.description}</Text>
                </View>
                <Switch
                  value={prefs[key]}
                  onValueChange={() => toggle(key)}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={prefs[key] ? Colors.primary : Colors.textMuted}
                />
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { flex: 1, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  rowDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warning + '20',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  infoIcon: { fontSize: 20, marginRight: Spacing.sm },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  infoText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
