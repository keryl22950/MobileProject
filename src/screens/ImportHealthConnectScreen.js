import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ensureHealthConnectReady, readRecentSessions } from '../services/healthConnect';
import { findChallengesForSession } from '../services/quickLog';
import { applyProgressOnly } from '../services/challenges';
import { recordUserActivity, getImportedExternalIds } from '../services/users';
import { CHALLENGE_PRESETS } from '../data/presets';
import Screen from '../components/Screen';

export default function ImportHealthConnectScreen() {
    const { uid, displayName } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [importingId, setImportingId] = useState(null);
    const [manual, setManual] = useState({});

    useEffect(() => {
        (async () => {
            try {
                await ensureHealthConnectReady();
                const [recent, imported] = await Promise.all([readRecentSessions(), getImportedExternalIds(uid)]);
                setSessions(recent.filter((s) => !imported.has(`hc_${s.id}`)));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [uid]);

    async function handleImport(session) {
        const preset = CHALLENGE_PRESETS.find((p) => p.id === session.presetId);
        const km = session.distanceKm ?? Number((manual[session.id] || '').replace(',', '.'));
        if (!preset || !km || km <= 0) return;
        const value = Number(km.toFixed(2));

        setImportingId(session.id);
        try {
            const { matches, skipped } = await findChallengesForSession({ uid, presetId: preset.id, at: session.startTime });

            const parts = [];
            if (matches.length > 0) {
                parts.push('Comptera pour :\n' + matches.map((m) => `• ${m.groupName} → ${m.groupementName} (${m.challengeLabel})`).join('\n'));
            }
            if (skipped.length > 0) {
                parts.push('Ne comptera pas :\n' + skipped.map((s) => `• ${s.label} : ${s.reason}`).join('\n'));
            }
            if (parts.length === 0) parts.push("Tu n'es dans aucun groupe pour l'instant.");

            Alert.alert(
                `Importer ${value} km ?`,
                parts.join('\n\n') + '\n\nDans tous les cas, la séance est ajoutée à ton profil.',
                [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Importer', onPress: () => confirmImport(session, preset, value, matches) },
                ]
            );
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setImportingId(null);
        }
    }

    async function confirmImport(session, preset, value, matches) {
        setImportingId(session.id);
        try {
            // 1. Profil d'abord (identifiant fixe : jamais de doublon).
            const added = await recordUserActivity({
                uid, presetId: preset.id, label: preset.label, icon: preset.icon, unit: preset.unit, value,
                date: session.startTime, externalId: `hc_${session.id}`, source: session.sourceLabel, durationMin: session.durationMin,
            });
            if (!added) {
                setSessions((prev) => prev.filter((s) => s.id !== session.id));
                return;
            }

            // 2. Puis les challenges dont la période en cours contient cette séance.
            await Promise.all(matches.map((m) =>
                applyProgressOnly({
                    groupId: m.groupId, groupementId: m.groupementId, challengeId: m.challengeId,
                    periodKey: m.periodKey, uid, userName: displayName, value, date: session.startTime,
                })
            ));

            setSessions((prev) => prev.filter((s) => s.id !== session.id));
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setImportingId(null);
        }
    }

    if (loading) {
        return <Screen style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></Screen>;
    }

    if (error) {
        return (
            <Screen style={[styles.container, { justifyContent: 'center' }]}>
                <Text style={styles.empty}>{error}</Text>
            </Screen>
        );
    }

    return (
        <Screen style={styles.container}>
            <Text style={styles.title}>Séances des 7 derniers jours</Text>
            <Text style={styles.hint}>
                Elles viennent de Health Connect : active la synchronisation dans l'appli de ta montre (Garmin Connect, Samsung Health…) si ta séance n'apparaît pas.
            </Text>
            <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm }}
                ListEmptyComponent={<Text style={styles.empty}>Aucune nouvelle séance à importer.</Text>}
                renderItem={({ item }) => {
                    const preset = CHALLENGE_PRESETS.find((p) => p.id === item.presetId);
                    if (!preset) return null;
                    const hasDistance = !!item.distanceKm;
                    const typed = Number((manual[item.id] || '').replace(',', '.'));
                    const canImport = hasDistance || typed > 0;
                    return (
                        <View style={styles.row}>
                            <Text style={styles.icon}>{preset.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>{preset.label} · {item.sourceLabel}</Text>
                                <Text style={styles.sub}>
                                    {item.startTime.toLocaleDateString('fr-FR')} {item.startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    {' · '}{item.durationMin} min
                                    {' · '}{hasDistance ? `${item.distanceKm.toFixed(2)} km` : 'pas de distance'}
                                </Text>
                                {!hasDistance && (
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        placeholder="Distance en km"
                                        placeholderTextColor={colors.muted}
                                        value={manual[item.id] || ''}
                                        onChangeText={(t) => setManual((prev) => ({ ...prev, [item.id]: t }))}
                                    />
                                )}
                            </View>
                            {importingId === item.id ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Pressable onPress={() => handleImport(item)} disabled={!canImport}>
                                    <Text style={[styles.action, !canImport && { opacity: 0.4 }]}>Importer</Text>
                                </Pressable>
                            )}
                        </View>
                    );
                }}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    title: { color: colors.text, fontSize: 18, fontWeight: '700' },
    hint: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: spacing.md, lineHeight: 17 },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    icon: { fontSize: 26 },
    label: { color: colors.text, fontWeight: '600' },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    action: { color: colors.primary, fontWeight: '700' },
    input: { backgroundColor: colors.background, borderRadius: 8, padding: spacing.sm, color: colors.text, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
});