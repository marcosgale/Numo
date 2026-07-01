import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useColors, Spacing, BorderRadius, FontSize } from '../constants/theme';

const FAQS = [
  {
    q: '¿Cómo funciona el saldo disponible?',
    a: 'Numo calcula tu saldo sumando todos tus ingresos y restando todos tus gastos del mes actual. Los ahorros vinculados a metas también se descuentan del saldo.',
  },
  {
    q: '¿Qué es la moneda base?',
    a: 'La moneda base es en la que se muestran tus totales y balances. Puedes añadir transacciones en otras monedas — Numo las convierte automáticamente usando el tipo de cambio actual.',
  },
  {
    q: '¿Cómo funciona el módulo de grupos?',
    a: 'Los grupos permiten compartir gastos con otras personas. Crea un grupo, invita a tus amigos con el código de invitación, y añade gastos compartidos. Numo calcula automáticamente quién debe a quién.',
  },
  {
    q: '¿Puedo editar o eliminar una transacción?',
    a: 'Sí. Desde el historial o el Dashboard, toca cualquier transacción para ver sus detalles. Desde ahí puedes editarla o eliminarla.',
  },
  {
    q: '¿Cómo funcionan las metas de ahorro?',
    a: 'Crea una meta con un nombre, cantidad objetivo y fecha límite. Cada vez que añadas dinero a una meta, se registra como un gasto en tu cuenta (categoría Ahorro) y se suma al progreso de tu meta.',
  },
  {
    q: '¿Qué son los límites de gasto?',
    a: 'Los límites te permiten establecer un tope de gasto por categoría (diario, semanal o mensual). Numo te avisa cuando te estás acercando al límite.',
  },
  {
    q: '¿Es segura mi información financiera?',
    a: 'Sí. Numo usa Supabase como base de datos con autenticación segura y políticas de acceso que garantizan que solo tú puedes ver tus datos. Nunca compartimos tu información con terceros.',
  },
  {
    q: '¿Puedo usar Numo sin conexión a internet?',
    a: 'Por el momento Numo requiere conexión a internet para sincronizar tus datos. Estamos trabajando en un modo offline para una futura versión.',
  },
];

export default function HelpScreen({ navigation }: any) {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayuda</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Preguntas frecuentes</Text>

        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.card, isOpen && styles.cardOpen]}
              onPress={() => setOpenIndex(isOpen ? null : i)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.question, isOpen && styles.questionOpen]}>{faq.q}</Text>
                {isOpen
                  ? <ChevronUp size={18} color={Colors.primary} />
                  : <ChevronDown size={18} color={Colors.textSecondary} />
                }
              </View>
              {isOpen && <Text style={styles.answer}>{faq.a}</Text>}
            </TouchableOpacity>
          );
        })}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>¿Tienes más preguntas?</Text>
          <Text style={styles.contactText}>
            Escríbenos a{' '}
            <Text style={styles.contactEmail}>marcosgl2705@gmail.com</Text>
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
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardOpen: { borderWidth: 1.5, borderColor: Colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  question: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginRight: Spacing.sm },
  questionOpen: { color: Colors.primary },
  answer: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  contactCard: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  contactTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  contactText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  contactEmail: { color: Colors.primary, fontWeight: '600' },
});
