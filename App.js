import React from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import NamePromptScreen from './src/screens/NamePromptScreen';
import { colors, spacing } from './src/theme';

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
  const { ready, displayName, uid, profileError, retryProfile } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (profileError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <Text style={{ color: colors.text }}>Profil indisponible. Vérifie ta connexion.</Text>
        <Pressable accessibilityRole="button" onPress={retryProfile}>
          <Text style={{ color: colors.primary }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
  if (!displayName) return <NamePromptScreen />;
  return <AppNavigator key={uid} />;
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
