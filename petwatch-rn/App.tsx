import React from 'react';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import AppNavigator from './src/navigation/AppNavigator';
import { OwnerNotificationsProvider } from './src/context/OwnerNotificationsContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <AuthProvider>
            <OwnerNotificationsProvider><AppNavigator /></OwnerNotificationsProvider>
            <StatusBar style="auto" />
            <Toast />
          </AuthProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
