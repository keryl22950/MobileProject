import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import GroupScreen from '../screens/GroupScreen';
import MembersScreen from '../screens/MembersScreen';
import CreateGroupementScreen from '../screens/CreateGroupementScreen';
import GroupementScreen from '../screens/GroupementScreen';
import StatsScreen from '../screens/StatsScreen';
import HistoriqueScreen from '../screens/HistoriqueScreen';
import GroupementHistoriqueScreen from '../screens/GroupementHistoriqueScreen';
import CreateChallengeScreen from '../screens/CreateChallengeScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import ChatScreen from '../screens/ChatScreen';

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
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Mes groupes' }} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Créer un groupe' }} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: 'Rejoindre un groupe' }} />
            <Stack.Screen name="Group" component={GroupScreen} options={{ title: 'Groupe' }} />
            <Stack.Screen name="Members" component={MembersScreen} options={{ title: 'Membres' }} />
            <Stack.Screen name="CreateGroupement" component={CreateGroupementScreen} options={{ title: 'Groupement' }} />
            <Stack.Screen name="Groupement" component={GroupementScreen} options={{ title: 'Groupement' }} />
            <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Statistiques' }} />
            <Stack.Screen name="Historique" component={HistoriqueScreen} options={{ title: 'Historique' }} />
            <Stack.Screen name="GroupementHistorique" component={GroupementHistoriqueScreen} options={{ title: 'Historique' }} />
            <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen} options={{ title: 'Nouveau challenge' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Challenge' }} />
            <Stack.Screen name="LogActivity" component={LogActivityScreen} options={{ title: 'Enregistrer une activité' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Discussion' }} />
        </Stack.Navigator>
    );
}