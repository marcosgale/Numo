import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Target, User } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { Colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';

const Tab = createBottomTabNavigator();

function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{name}</Text>
    </View>
  );
}

export default function Navigation() {
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
    </NavigationContainer>
  );
}