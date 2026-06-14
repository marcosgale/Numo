import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Users, Target, User, Plus } from 'lucide-react-native';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import AddButton from '../components/AddButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{name}</Text>
    </View>
  );
}

function EmptyScreen() {
  return <View />;
}

function MainTabs({ navigation }: any) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddOption = (option: 'expense' | 'income' | 'shared' | 'recurring') => {
    if (option === 'shared') {
      Alert.alert('Próximamente', 'Los gastos compartidos estarán disponibles pronto');
      return;
    }

    navigation.navigate('AddTransaction', {
      type: option === 'income' ? 'income' : 'expense',
      isRecurring: option === 'recurring',
    });
  };

  return (
    <>
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
            tabBarIcon: () => null,
            tabBarButton: () => (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
                style={{ top: -10, justifyContent: 'center', alignItems: 'center' }}
              >
                <View style={styles.fab}>
                  <Plus size={28} color="#fff" />
                </View>
              </TouchableOpacity>
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
    </>
  );
}

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
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
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});