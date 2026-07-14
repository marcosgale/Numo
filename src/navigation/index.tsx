import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Users, TrendingUp, User, Plus } from 'lucide-react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
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
import SelectGroupScreen from '../screens/SelectGroupScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import HelpScreen from '../screens/HelpScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PlannerScreen from '../screens/PlannerScreen';
import AddButton from '../components/AddButton';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function EmptyScreen() {
  return <View />;
}

function MainTabs({ navigation }: any) {
  const Colors = useColors();
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddOption = (option: 'expense' | 'income' | 'shared' | 'recurring') => {
    if (option === 'shared') {
      setModalVisible(false);
      navigation.navigate('SelectGroup');
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
            tabBarLabel: t.navigation.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Grupos"
          component={GroupsScreen}
          options={{
            tabBarLabel: t.navigation.groups,
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
          name="Planifica"
          component={GoalsScreen}
          options={{
            tabBarLabel: t.navigation.plan,
            tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Perfil"
          component={ProfileScreen}
          options={{
            tabBarLabel: t.navigation.profile,
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
  const Colors = useColors();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
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
        <Stack.Screen
          name="SelectGroup"
          component={SelectGroupScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Help"
          component={HelpScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Planner"
          component={PlannerScreen}
          options={{ animation: 'slide_from_right' }}
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
    backgroundColor: '#1DB87A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});