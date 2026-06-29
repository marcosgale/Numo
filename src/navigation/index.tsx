import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Users, Target, User, Plus } from 'lucide-react-native';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GoalsScreen from '../screens/GoalsScreen';
import AddGoalScreen from '../screens/AddGoalScreen';
import GoalDetailScreen from '../screens/GoalDetailScreen';
import LimitsScreen from '../screens/LimitsScreen';
import AddLimitScreen from '../screens/AddLimitScreen';
import GroupsScreen from '../screens/GroupsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddGroupExpenseScreen from '../screens/AddGroupExpenseScreen';
import AddButton from '../components/AddButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
          component={GroupsScreen}
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
          component={GoalsScreen}
          options={{
            tabBarIcon: ({ color }) => <Target size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Perfil"
          component={ProfileScreen}
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
        <Stack.Screen
          name="AddGoal"
          component={AddGoalScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="GoalDetail"
          component={GoalDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Limits"
          component={LimitsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AddLimit"
          component={AddLimitScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="CreateGroup"
          component={CreateGroupScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="GroupDetail"
          component={GroupDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AddGroupExpense"
          component={AddGroupExpenseScreen}
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