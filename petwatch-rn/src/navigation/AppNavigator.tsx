import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NavigationIcon from '../components/NavigationIcon';
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
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ClinicSelectionScreen from '../screens/ClinicSelectionScreen';
import HomeScreen from '../screens/HomeScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ClinicConversationScreen from '../screens/ClinicConversationScreen';
import AlertsScreen, { isDiseaseAlert } from '../screens/AlertsScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PetDetailsScreen from '../screens/PetDetailsScreen';
import PetProfileScreen from '../screens/PetProfileScreen';
import ArchivedPetsScreen from '../screens/ArchivedPetsScreen';
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
const HomeStack = createNativeStackNavigator();

function HomeNav() {
  return <HomeStack.Navigator id="HomeStack" screenOptions={{ headerShown: false, animation: 'none' }}>
    <HomeStack.Screen name="HomeOverview" component={HomeScreen} />
    <HomeStack.Screen name="NearbyClinics" component={NearbyClinicsScreen} />
    <HomeStack.Screen name="HealthTips" component={HealthTipsScreen} />
  </HomeStack.Navigator>;
}


function TabNav() {
  const { colors: tc } = useTheme();
  const { notifications } = useOwnerNotifications();
  const unread = notifications.filter(item => !item.read && isDiseaseAlert(item)).length;
  return (
    <Tab.Navigator id="MainTabs" screenOptions={({ route }) => ({
      headerShown: false,
      animation: 'none',
      tabBarStyle: { backgroundColor: tc.surface, borderTopColor: tc.border, height: 66, paddingTop: 5, paddingBottom: 8 },
      tabBarActiveTintColor: '#005638',
      tabBarLabelStyle: { fontSize: 12 },
      tabBarLabel: ({ focused, color }) => <View style={{ alignItems: 'center', width: 78 }}><Text style={{ color, fontSize: 12, fontWeight: focused ? '700' : '400' }}>{route.name}</Text>{focused && <View style={{ position: 'absolute', bottom: -9, height: 3, width: 64, borderRadius: 2, backgroundColor: '#005638' }} />}</View>,
      tabBarInactiveTintColor: tc.text,
      tabBarIcon: ({ focused, color }) => {
        return <View style={{ width: 78, height: 27, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#E1F3E6' : 'transparent' }}><NavigationIcon name={route.name} color={color} /></View>;
      },
    })}>
      <Tab.Screen name="Home" component={HomeNav} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, needsFirstPet, isRestoring } = useAuth();
  const { hasSeenOnboarding } = useOnboarding();

  if (isRestoring) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background }}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false, animation: 'none' }}>
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
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen name="ClinicSelection" component={ClinicSelectionScreen} />
          </>
        ) : (
          // App flow
          <>
            {needsFirstPet && <Stack.Screen name="AddPet" component={AddPetScreen} />}
            <Stack.Screen name="Main" component={TabNav} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="ClinicConversation" component={ClinicConversationScreen} />
            <Stack.Screen name="Notifications" component={AlertsScreen} />
            <Stack.Screen name="ArchivedPets" component={ArchivedPetsScreen} />
            <Stack.Screen name="PetProfile" component={PetProfileScreen} />
            <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
            {!needsFirstPet && <Stack.Screen name="AddPet" component={AddPetScreen} />}
            <Stack.Screen name="ReportSymptoms" component={ReportSymptomsScreen} />
            <Stack.Screen name="Vaccinations" component={VaccinationsScreen} />
            <Stack.Screen name="HealthHistory" component={HealthHistoryScreen} />
            <Stack.Screen name="HealthReport" component={HealthReportScreen} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
            <Stack.Screen name="HealthTips" component={HealthTipsScreen} />
            <Stack.Screen name="ClinicSelection" component={ClinicSelectionScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
