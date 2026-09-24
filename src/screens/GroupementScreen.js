import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToMembers } from '../services/groups';
import { subscribeToGroupement, startGroupement, getCurrentPeriod } from '../services/groupements';
import { useGroupementFill } from '../hooks/useGroupementFill';
import Countdown from '../components/Countdown';
import Screen from '../components/Screen';

export default function GroupementScreen({ navigation, route }) {
    const { groupId, groupementId } = route.params;
    const { uid } = useAuth();
    const [groupement, setGroupement] = useState(null);
    const [members, setMembers] = useState([]);
    const [starting, setStarting] = useState(false);
    const { challenges, fills, overallPct } = useGroupementFill(groupId, groupementId, groupement);

    useEffect(() => {
        const u1 = subscribeToGroupement(groupId, groupementId, setGroupement);
        const u2 = subscribeToMembers(groupId, setMembers);
        return () => { u1(); u2(); };
    }, [groupId, groupementId]);

    if (!groupement) {
        return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
    }

    const me = members.find((m) => m.id === uid);
    const isAdmin = me?.role === 'creator' || me?.role === 'admin';
    const period = getCurrentPeriod(groupement);
    const isPending = groupement.status === 'pending';
    const started = period && !period.notStarted;

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

    let countdownLabel = null;
    let countdownTarget = null;
    if (period?.notStarted) {
        countdownLabel = 'Démarre le ' + period.periodEnd.toLocaleDateString('fr-FR') + ' à ' + period.periodEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        countdownTarget = period.periodEnd;
    } else if (period) {
        countdownLabel = groupement.recurring ? `Période #${period.periodIndex + 1} — temps restant` : 'Temps restant';
        countdownTarget = period.periodEnd;
    }

    return (
        <Screen style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{groupement.name}</Text>
                <Text style={styles.subtitle}>{groupement.recurring ? 'Récurrent' : 'Ponctuel'}</Text>
                {isPending && <Text style={styles.pending}>En attente de démarrage</Text>}
            </View>

            {countdownTarget && <Countdown target={countdownTarget} label={countdownLabel} />}

            {started && challenges.length > 0 && (
                <View style={styles.overallCard}>
                    <View style={styles.overallBarBg}><View style={[styles.overallBarFill, { width: `${overallPct}%` }]} /></View>
                    <Text style={styles.overallText}>Avancement global : {overallPct}%</Text>
                </View>
            )}

            {isPending && isAdmin && (
                <Pressable style={styles.startButton} onPress={handleStart} disabled={starting}>
                    {starting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>▶ Démarrer l'événement</Text>}
                </Pressable>
            )}
            {isPending && !isAdmin && <Text style={styles.hint}>En attente qu'un admin démarre cet événement.</Text>}

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
                renderItem={({ item }) => {
                    const fill = fills[item.id];
                    const pct = fill?.pct || 0;
                    return (
                        <Pressable
                            style={styles.challengeCard}
                            onPress={() => navigation.navigate('Challenge', { /* ... inchangé ... */ })}
                        >
                            {started && (
                                <View style={styles.challengeCardClip}>
                                    <View style={[styles.challengeFill, { width: `${pct}%` }]} />
                                </View>
                            )}
                            <Text style={styles.challengeIcon}>{item.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.challengeLabel}>{item.label}</Text>
                                <Text style={styles.challengeSub}>
                                    {started && fill ? `${fill.sum.toFixed(1)}/${item.target} ${item.unit}` : `Objectif : ${item.target} ${item.unit}`}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
            />

            {isAdmin && (
                <Pressable style={[styles.button, styles.buttonPrimary, { marginTop: spacing.md }]} onPress={() => navigation.navigate('CreateChallenge', { groupId, groupementId })}>
                    <Text style={styles.buttonText}>+ Nouveau challenge</Text>
                </Pressable>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { alignItems: 'center' },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pending: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
    hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
    startButton: { backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md },
    overallCard: { marginBottom: spacing.md },
    overallBarBg: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
    overallBarFill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
    overallText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
    actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    challengeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, position: 'relative' },
    challengeCardClip: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 12, overflow: 'hidden' },
    challengeFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(34,197,94,0.18)' },
    challengeIcon: { fontSize: 26 },
    challengeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
    challengeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    buttonPrimary: { backgroundColor: colors.primary },
    buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },

});