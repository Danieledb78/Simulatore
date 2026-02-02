import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import DeliveriesScreen from './src/screens/DeliveriesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Store
import { useAuthStore } from './src/store/authStore';

// Icons (placeholder - in produzione usare @expo/vector-icons)
import { Text, View } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

// Placeholder Icon component
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: focused ? '#0ea5e9' : '#9ca3af' }}>
      {name === 'Dashboard' ? '📊' :
       name === 'Scanner' ? '📷' :
       name === 'Ordini' ? '📋' :
       name === 'Consegne' ? '🚚' : '👤'}
    </Text>
  </View>
);

function MainTabs() {
  const { user } = useAuthStore();
  const isDriver = user?.role === 'DRIVER';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#9ca3af',
        headerStyle: { backgroundColor: '#0ea5e9' },
        headerTintColor: '#fff',
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
      {!isDriver && (
        <Tab.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ title: 'Scansiona' }}
        />
      )}
      {!isDriver && (
        <Tab.Screen
          name="Ordini"
          component={OrdersScreen}
          options={{ title: 'Ordini' }}
        />
      )}
      {isDriver && (
        <Tab.Screen
          name="Consegne"
          component={DeliveriesScreen}
          options={{ title: 'Consegne' }}
        />
      )}
      <Tab.Screen
        name="Profilo"
        component={ProfileScreen}
        options={{ title: 'Profilo' }}
      />
    </Tab.Navigator>
  );
}

function Navigation() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Navigation />
          <StatusBar style="auto" />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
