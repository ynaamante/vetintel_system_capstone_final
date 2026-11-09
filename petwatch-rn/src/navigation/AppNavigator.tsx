import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { colors } from '../theme/colors';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import WalkthroughScreen from '../screens/WalkthroughScreen';
import TooltipGuideScreen from '../screens/TooltipGuideScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ClinicSelectionScreen from '../screens/ClinicSelectionScreen';
import HomeScreen from '../screens/HomeScreen';
import AlertsScreen from '../screens/AlertsScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PetDetailsScreen from '../screens/PetDetailsScreen';
import AddPetScreen from '../screens/AddPetScreen';
import ReportSymptomsScreen from '../screens/ReportSymptomsScreen';
import VaccinationsScreen from '../screens/VaccinationsScreen';
import HealthHistoryScreen from '../screens/HealthHistoryScreen';
import HealthReportScreen from '../screens/HealthReportScreen';
import BookAppointmentScreen from '../screens/BookAppointmentScreen';
import NearbyClinicsScreen from '../screens/NearbyClinicsScreen';
import HealthTipsScreen from '../screens/HealthTipsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNav() {
  const { colors: tc } = useTheme();
  const { unreadCount: unread } = useOwnerNotifications();
  return (
    <Tab.Navigator id="MainTabs" screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: tc.surface, borderTopColor: tc.border, height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: tc.textMuted,
      tabBarIcon: ({ focused, color, size }) => {
        const icons: Record<string, [string, string]> = {
          Home: ['home', 'home-outline'], Alerts: ['notifications', 'notifications-outline'],
          Appointments: ['calendar', 'calendar-outline'], Profile: ['person', 'person-outline'],
        };
        const [active, inactive] = icons[route.name] || ['home', 'home-outline'];
        return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn } = useAuth();
  const { hasSeenOnboarding } = useOnboarding();

  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        {!hasSeenOnboarding ? (
          // Onboarding flow
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Walkthrough" component={WalkthroughScreen} />
            <Stack.Screen name="TooltipGuide" component={TooltipGuideScreen} />
          </>
        ) : !isLoggedIn ? (
          // Auth flow
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ClinicSelection" component={ClinicSelectionScreen} />
          </>
        ) : (
          // App flow
          <>
            <Stack.Screen name="Main" component={TabNav} />
            <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
            <Stack.Screen name="AddPet" component={AddPetScreen} />
            <Stack.Screen name="ReportSymptoms" component={ReportSymptomsScreen} />
            <Stack.Screen name="Vaccinations" component={VaccinationsScreen} />
            <Stack.Screen name="HealthHistory" component={HealthHistoryScreen} />
            <Stack.Screen name="HealthReport" component={HealthReportScreen} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
            <Stack.Screen name="NearbyClinics" component={NearbyClinicsScreen} />
            <Stack.Screen name="HealthTips" component={HealthTipsScreen} />
            <Stack.Screen name="ClinicSelection" component={ClinicSelectionScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
