import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToMembers } from '../services/groups';
import { subscribeToGroupement, startGroupement, getCurrentPeriod } from '../services/groupements';
import { subscribeToChallenges } from '../services/challenges';

function formatTimeLeft(periodEnd) {
    if (!periodEnd) return '';
    const diffMs = periodEnd.getTime() - Date.now();
    if (diffMs <= 0) return 'Terminé';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h restantes`;
    return `${hours}h restantes`;
}

export default function GroupementScreen({ navigation, route }) {
    const { groupId, groupementId } = route.params;
    const { uid } = useAuth();
    const [groupement, setGroupement] = useState(null);
    const [members, setMembers] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        const u1 = subscribeToGroupement(groupId, groupementId, setGroupement);
        const u2 = subscribeToMembers(groupId, setMembers);
        const u3 = subscribeToChallenges(groupId, groupementId, setChallenges);
        return () => { u1(); u2(); u3(); };
    }, [groupId, groupementId]);

    if (!groupement) {
        return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
    }

    const me = members.find((m) => m.id === uid);
    const isAdmin = me?.role === 'creator' || me?.role === 'admin';
    const period = getCurrentPeriod(groupement);
    const isPending = groupement.status === 'pending';

    async function handleStart() {
        setStarting(true);
        try {
            await startGroupement({ groupId, groupementId });
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setStarting(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{groupement.name}</Text>
                <Text style={styles.subtitle}>
                    {groupement.recurring ? `Récurrent · période #${period ? period.periodIndex + 1 : 1}` : 'Ponctuel'}
                </Text>
                {isPending ? (
                    <Text style={styles.pending}>En attente de démarrage</Text>
                ) : (
                    <Text style={styles.timeLeft}>⏳ {formatTimeLeft(period?.periodEnd)}</Text>
                )}
            </View>

            {isPending && isAdmin && (
                <Pressable style={styles.startButton} onPress={handleStart} disabled={starting}>
                    {starting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>▶ Démarrer le groupement</Text>}
                </Pressable>
            )}
            {isPending && !isAdmin && <Text style={styles.hint}>En attente qu'un admin démarre ce groupement.</Text>}

            <View style={styles.actionsRow}>
                <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Stats', { groupId, groupementId })}>
                    <Text style={styles.buttonText}>📊 Stats cumulées</Text>
                </Pressable>
                {isAdmin && (
                    <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('CreateGroupement', { groupId, groupementId })}>
                        <Text style={styles.buttonText}>✏️ Modifier</Text>
                    </Pressable>
                )}
            </View>

            <Text style={styles.sectionTitle}>Challenges</Text>
            <FlatList
                data={challenges}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm }}
                ListEmptyComponent={<Text style={styles.empty}>Aucun challenge pour l'instant.</Text>}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.challengeCard}
                        disabled={isPending}
                        onPress={() => navigation.navigate('Challenge', {
                            groupId, groupementId, challengeId: item.id,
                            periodKey: period?.periodKey, periodEnd: period?.periodEnd?.toISOString(),
                        })}
                    >
                        <Text style={styles.challengeIcon}>{item.icon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.challengeLabel}>{item.label}</Text>
                            <Text style={styles.challengeSub}>Objectif : {item.target} {item.unit}</Text>
                        </View>
                    </Pressable>
                )}
            />

            {isAdmin && !isPending && (
                <Pressable style={[styles.button, styles.buttonPrimary, { marginTop: spacing.md }]} onPress={() => navigation.navigate('CreateChallenge', { groupId, groupementId })}>
                    <Text style={styles.buttonText}>+ Nouveau challenge</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { marginBottom: spacing.md },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pending: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
    timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
    hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
    startButton: { backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md },
    actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    challengeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
    challengeIcon: { fontSize: 26 },
    challengeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
    challengeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    buttonPrimary: { backgroundColor: colors.primary },
    buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },
});