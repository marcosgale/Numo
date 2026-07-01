import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';

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

const OPTIONS = [
  {
    key: 'dailySummary' as keyof Prefs,
    title: 'Resumen diario',
    description: 'Recibe un resumen de tus gastos e ingresos cada día',
  },
  {
    key: 'limitAlerts' as keyof Prefs,
    title: 'Alertas de límites',
    description: 'Aviso cuando te acerques al 80% de un límite de gasto',
  },
  {
    key: 'goalReminders' as keyof Prefs,
    title: 'Recordatorios de metas',
    description: 'Notificación cuando una meta esté próxima a vencer',
  },
  {
    key: 'groupExpenses' as keyof Prefs,
    title: 'Gastos en grupos',
    description: 'Aviso cuando alguien añada un gasto en un grupo compartido',
  },
];

export default function NotificationsScreen({ navigation }: any) {
  const Colors = useColors();
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
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Elige qué notificaciones quieres recibir
        </Text>

        <View style={styles.card}>
          {OPTIONS.map((opt, i) => (
            <View key={opt.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{opt.title}</Text>
                <Text style={styles.rowDesc}>{opt.description}</Text>
              </View>
              <Switch
                value={prefs[opt.key]}
                onValueChange={() => toggle(opt.key)}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={prefs[opt.key] ? Colors.primary : Colors.textMuted}
              />
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Las notificaciones push estarán disponibles próximamente. Tus preferencias se guardarán para cuando estén activas.
          </Text>
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
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, textAlign: 'center' },
});
