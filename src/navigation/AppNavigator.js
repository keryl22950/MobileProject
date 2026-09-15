import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CreateChallengeScreen from '../screens/CreateChallengeScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import GroupScreen from '../screens/GroupScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import ChatScreen from '../screens/ChatScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#111827' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
  contentStyle: { backgroundColor: '#0b0f19' },
};

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Mes challenges' }}
      />
      <Stack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{ title: 'Créer un challenge' }}
      />
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: 'Rejoindre un groupe' }}
      />
      <Stack.Screen
        name="Group"
        component={GroupScreen}
        options={{ title: 'Challenge' }}
      />
      <Stack.Screen
        name="LogActivity"
        component={LogActivityScreen}
        options={{ title: 'Enregistrer une activité' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Discussion' }}
      />
      <Stack.Screen
        name="ActivityDetail"
        component={ActivityDetailScreen}
        options={{ title: "Détail de l'activité" }}
      />
    </Stack.Navigator>
  );
}
