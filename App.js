import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import NamePromptScreen from './src/screens/NamePromptScreen';
import { colors } from './src/theme';

const linking = {
    prefixes: ['challengeapp://'],
    config: {
        screens: {
            Home: 'home',
            JoinGroup: 'join/:code',
        },
    },
};

function Gate() {
  const { ready, displayName } = useAuth();
  if (!ready) {
    return (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
    );
  }
  if (!displayName) return <NamePromptScreen />;
  return <AppNavigator />;
}

export default function App() {
  return (
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar style="light" />
            <Gate />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
  );
}