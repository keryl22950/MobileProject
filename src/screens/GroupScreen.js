import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Share, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToGroup, subscribeToMembers } from '../services/groups';
import { subscribeToGroupements, getCurrentPeriod } from '../services/groupements';
import { useGroupementFill } from '../hooks/useGroupementFill';
import Screen from '../components/Screen';

function GroupementCard({ groupId, groupement, onPress }) {
    const { overallPct } = useGroupementFill(groupId, groupement.id, groupement);
    const period = getCurrentPeriod(groupement);
    const started = period && !period.notStarted;

    let subtitle;
    if (groupement.status === 'pending') {
        subtitle = 'En attente de démarrage';
    } else if (period?.notStarted) {
        subtitle = `Débute le ${period.periodEnd.toLocaleDateString('fr-FR')} à ${period.periodEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (groupement.recurring) {
        subtitle = `Récurrent · période #${period.periodIndex + 1} · ${overallPct}%`;
    } else {
        subtitle = `Ponctuel · en cours · ${overallPct}%`;
    }

    return (
        <Pressable style={styles.card} onPress={onPress}>
            {started && <View style={[styles.cardFill, { width: `${overallPct}%` }]} />}
            <Text style={styles.cardIcon}>{groupement.recurring ? '🔁' : '📅'}</Text>
            <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{groupement.name}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
        </Pressable>
    );
}

export default function GroupScreen({ navigation, route }) {
    const { groupId } = route.params;
    const { uid } = useAuth();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [groupements, setGroupements] = useState([]);

    useEffect(() => {
        const u1 = subscribeToGroup(groupId, setGroup);
        const u2 = subscribeToMembers(groupId, setMembers);
        const u3 = subscribeToGroupements(groupId, setGroupements);
        return () => { u1(); u2(); u3(); };
    }, [groupId]);

    if (!group) {
        return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
    }

    const me = members.find((m) => m.id === uid);
    const isAdmin = me?.role === 'creator' || me?.role === 'admin';

    function handleShare() {
        const deepLink = `challengeapp://join/${group.inviteCode}`;
        Share.share({
            message: `Rejoins mon groupe "${group.name}" !\n\nSi tu as déjà l'app : ${deepLink}\nSinon installe l'app, puis entre ce code : ${group.inviteCode}`,
        });
    }

    return (
        <Screen style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.groupTitle}>👥 {group.name}</Text>
                <Text style={styles.code}>Code : {group.inviteCode} · {members.length} membres</Text>
            </View>

            <View style={styles.topActions}>
                <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Members', { groupId })}>
                    <Text style={styles.buttonText}>👤 Membres</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Chat', { groupId })}>
                    <Text style={styles.buttonText}>💬 Chat</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Historique', { groupId })}>
                    <Text style={styles.buttonText}>🕓 Historique</Text>
                </Pressable>
            </View>
            <Pressable style={[styles.button, styles.buttonSecondary, { marginBottom: spacing.md }]} onPress={handleShare}>
                <Text style={styles.buttonText}>📤 Inviter avec le code</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Événements</Text>
            <FlatList
                data={groupements}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm }}
                ListEmptyComponent={<Text style={styles.empty}>Aucun événement pour l'instant.</Text>}
                renderItem={({ item }) => (
                    <GroupementCard groupId={groupId} groupement={item} onPress={() => navigation.navigate('Groupement', { groupId, groupementId: item.id })} />
                )}
            />

            {isAdmin && (
                <Pressable style={[styles.button, styles.buttonPrimary, { marginTop: spacing.md }]} onPress={() => navigation.navigate('CreateGroupement', { groupId })}>
                    <Text style={styles.buttonText}>+ Nouvel événement</Text>
                </Pressable>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { marginBottom: spacing.md },
    groupTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
    code: { color: colors.muted, fontSize: 12, marginTop: 4 },
    topActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
    cardFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(99,102,241,0.18)', borderRadius: 12},
    cardIcon: { fontSize: 26 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
    cardSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    buttonPrimary: { backgroundColor: colors.primary },
    buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },
});