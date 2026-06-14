import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Target, User, Plus } from 'lucide-react-native';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import AddButton from '../components/AddButton';

const Tab = createBottomTabNavigator();

function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{name}</Text>
    </View>
  );
}

function EmptyScreen() {
  // Pantalla vacía: nunca se ve, solo existe para que la tab del botón "+" exista
  return <View />;
}

export default function Navigation() {
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddOption = (option: 'expense' | 'income' | 'shared' | 'recurring') => {
    if (option === 'shared') {
      Alert.alert('Próximamente', 'Los gastos compartidos estarán disponibles pronto');
      return;
    }
    Alert.alert('Seleccionado', `Has elegido: ${option}`);
  };

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            height: 60,
            paddingBottom: 8,
          },
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={DashboardScreen}
          options={{
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Grupos"
          children={() => <PlaceholderScreen name="Grupos" />}
          options={{
            tabBarIcon: ({ color }) => <Users size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Add"
          component={EmptyScreen}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={styles.fab}>
                <Plus size={28} color="#fff" />
              </View>
            ),
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Metas"
          children={() => <PlaceholderScreen name="Metas" />}
          options={{
            tabBarIcon: ({ color }) => <Target size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Perfil"
          children={() => <PlaceholderScreen name="Perfil" />}
          options={{
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
      </Tab.Navigator>

      <AddButton
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelectOption={handleAddOption}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});