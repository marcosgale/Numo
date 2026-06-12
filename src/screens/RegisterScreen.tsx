import { useState } from 'react'; // useState: el hermano de useEffect. Guarda datos que CAMBIAN (lo que el usuario teclea)
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { supabase } from '../services/supabase';

export default function RegisterScreen() {
  // Cada useState crea una "cajita" con un valor y su función para cambiarlo:
  const [email, setEmail] = useState('');       // empieza vacío
  const [password, setPassword] = useState(''); // empieza vacío
  const [loading, setLoading] = useState(false); // para desactivar el botón mientras se registra

  const handleRegister = async () => {
    setLoading(true); // botón a "cargando"
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message); // popup nativo del iPhone
    } else {
      Alert.alert('¡Cuenta creada!', 'Ya puedes usar Numo');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Empieza a controlar tus finanzas</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textSecondary}
          value={email}                  // el input MUESTRA lo que hay en la cajita
          onChangeText={setEmail}        // y cada tecla ACTUALIZA la cajita
          autoCapitalize="none"          // emails sin mayúscula automática
          keyboardType="email-address"   // teclado con @ visible
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={Colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry                // puntitos en vez de letras
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}             // no se puede pulsar dos veces
        >
          <Text style={styles.buttonText}>{loading ? 'Creando...' : 'Registrarme'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});