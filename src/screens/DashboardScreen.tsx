import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ShoppingCart, UtensilsCrossed } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

const friends = [
  { name: 'Laura', initials: 'LA', amount: '+23,50€', positive: true, color: '#1DB87A' },
  { name: 'Marcos', initials: 'MA', amount: '+47,00€', positive: true, color: '#9B59B6' },
  { name: 'Sonia', initials: 'SO', amount: '-15,00€', positive: false, color: '#F39C12' },
  { name: 'Iván', initials: 'IV', amount: '+8,00€', positive: true, color: '#3498DB' },
];

const limits = [
  { name: 'Transporte', spent: 76, limit: 80, pct: 95, color: Colors.negative },
  { name: 'Restaurantes', spent: 145, limit: 200, pct: 72, color: Colors.warning },
];

const transactions = [
  { name: 'Mercadona', category: 'Compras · Hoy', amount: '-34,50€', icon: 'cart' },
  { name: 'Café Gijón', category: 'Restaurantes · Ayer', amount: '-4,80€', icon: 'food' },
];

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Buenos días,</Text>
            <Text style={styles.name}>Alejandra 👋</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Bell size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* TARJETA SALDO */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO DISPONIBLE REAL</Text>
          <Text style={styles.balanceAmount}>1.240,50 €</Text>
          <Text style={styles.balanceUpdated}>Actualizado hace un momento</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Ingresos</Text>
              <Text style={styles.balanceMiniPos}>+1850,00€</Text>
              <Text style={styles.balanceMiniSub}>Este mes</Text>
            </View>
            <View style={styles.balanceMini}>
              <Text style={styles.balanceMiniLabel}>Gastos</Text>
              <Text style={styles.balanceMiniNeg}>-610,00€</Text>
              <Text style={styles.balanceMiniSub}>Este mes</Text>
            </View>
          </View>
        </View>

        {/* BALANCES CON AMIGOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Balances con amigos</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todos {'>'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {friends.map((f) => (
              <View key={f.name} style={styles.friendCard}>
                <View style={[styles.avatar, { backgroundColor: f.color }]}>
                  <Text style={styles.avatarText}>{f.initials}</Text>
                  <View style={[styles.avatarDot, { backgroundColor: f.positive ? Colors.positive : Colors.negative }]} />
                </View>
                <Text style={styles.friendName}>{f.name}</Text>
                <Text style={[styles.friendAmount, { color: f.positive ? Colors.positive : Colors.negative }]}>
                  {f.amount}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* LÍMITES DEL MES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Límites del mes</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todos {'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {limits.map((item, index) => (
              <View key={item.name} style={[styles.limitRow, index < limits.length - 1 && styles.limitBorder]}>
                <View style={styles.limitTop}>
                  <Text style={styles.limitName}>{item.name}</Text>
                  <Text style={styles.limitAmount}>{item.spent},00€ / {item.limit},00€</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* METAS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tus metas</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todas {'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaName}>Viaje a Japón ✈️</Text>
              <View style={styles.metaPctBadge}>
                <Text style={styles.metaPctText}>62%</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '62%', backgroundColor: Colors.primary }]} />
            </View>
            <View style={styles.metaDetails}>
              <Text style={styles.metaSub}>1.240,00€ ahorrados</Text>
              <Text style={styles.metaSub}>Faltan 760,00€</Text>
            </View>
          </View>
        </View>

        {/* ÚLTIMOS MOVIMIENTOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Últimos movimientos</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todos {'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {transactions.map((tx, index) => (
              <View key={tx.name} style={[styles.txRow, index < transactions.length - 1 && styles.txBorder]}>
                <View style={styles.txIcon}>
                  {tx.icon === 'cart'
                    ? <ShoppingCart size={18} color="#9B59B6" />
                    : <UtensilsCrossed size={18} color="#F39C12" />
                  }
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txName}>{tx.name}</Text>
                  <Text style={styles.txCategory}>{tx.category}</Text>
                </View>
                <Text style={styles.txAmount}>{tx.amount}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.sm, color: Colors.textSecondary },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  balanceCard: { backgroundColor: '#1C3A30', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  balanceLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 4 },
  balanceUpdated: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginBottom: Spacing.md },
  balanceRow: { flexDirection: 'row', gap: Spacing.sm },
  balanceMini: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  balanceMiniLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  balanceMiniPos: { fontSize: FontSize.md, fontWeight: '700', color: Colors.positive },
  balanceMiniNeg: { fontSize: FontSize.md, fontWeight: '700', color: Colors.negative },
  balanceMiniSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  friendCard: { alignItems: 'center', marginRight: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, minWidth: 85, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  avatarDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  friendName: { fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 2, fontWeight: '500' },
  friendAmount: { fontSize: FontSize.sm, fontWeight: '700' },
  limitRow: { paddingVertical: Spacing.sm },
  limitBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.xs },
  limitTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  limitName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  limitAmount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  metaName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  metaPctBadge: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  metaPctText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  metaDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  metaSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  txBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  txInfo: { flex: 1 },
  txName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  txCategory: { fontSize: FontSize.xs, color: Colors.textSecondary },
  txAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
});