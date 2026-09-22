import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing } from '../theme';
import { CHALLENGE_PRESETS } from '../data/presets';
import { useAuth } from '../context/AuthContext';
import { findActiveChallengesForPreset } from '../services/quickLog';
import { logActivity } from '../services/challenges';
import { distanceKm } from '../utils/geo';
import Screen from '../components/Screen';

const QUICK_PRESETS = CHALLENGE_PRESETS.filter((p) => p.id !== 'custom');

export default function QuickLogScreen({ navigation }) {
    const { uid, displayName } = useAuth();
    const [preset, setPreset] = useState(null);
    const [matches, setMatches] = useState(null);
    const [selected, setSelected] = useState({});
    const [searching, setSearching] = useState(false);
    const [manualValue, setManualValue] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [trackedDistance, setTrackedDistance] = useState(0);
    const [saving, setSaving] = useState(false);
    const watchSubscription = useRef(null);
    const lastPoint = useRef(null);

    async function handleSelectPreset(p) {
        setPreset(p);
        setSearching(true);
        try {
            const found = await findActiveChallengesForPreset({ uid, presetId: p.id });
            setMatches(found);
            setSelected(Object.fromEntries(found.map((m) => [m.challengeId + m.groupId, true])));
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setSearching(false);
        }
    }

    function toggleMatch(key) {
        setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    async function startTracking() {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission refusée', "L'accès à la position est nécessaire pour le suivi GPS.");
            return;
        }
        setIsTracking(true);
        setTrackedDistance(0);
        lastPoint.current = null;
        watchSubscription.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
            (loc) => {
                const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                if (lastPoint.current) setTrackedDistance((prev) => prev + distanceKm(lastPoint.current, point));
                lastPoint.current = point;
            }
        );
    }

    function stopTracking() {
        if (watchSubscription.current) {
            watchSubscription.current.remove();
            watchSubscription.current = null;
        }
        setIsTracking(false);
    }

    async function handleSave(value) {
        if (!value || value <= 0) { Alert.alert('Valeur invalide', 'Indique une valeur supérieure à 0.'); return; }
        const targets = matches.filter((m) => selected[m.challengeId + m.groupId]);
        if (targets.length === 0) { Alert.alert('Rien à enregistrer', 'Sélectionne au moins un challenge.'); return; }

        setSaving(true);
        try {
            await Promise.all(targets.map((m) =>
                logActivity({ groupId: m.groupId, groupementId: m.groupementId, challengeId: m.challengeId, periodKey: m.periodKey, uid, userName: displayName, value })
            ));
            navigation.goBack();
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setSaving(false);
        }
    }

    if (!preset) {
        return (
            <Screen style={styles.container}>
                <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
                    <Text style={styles.sectionTitle}>Quel type d'activité ?</Text>
                    <View style={styles.grid}>
                        {QUICK_PRESETS.map((p) => (
                            <Pressable key={p.id} style={styles.presetItem} onPress={() => handleSelectPreset(p)}>
                                <Text style={styles.presetIcon}>{p.icon}</Text>
                                <Text style={styles.presetLabel}>{p.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            </Screen>
        );
    }

    if (searching) {
        return <Screen style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></Screen>;
    }

    return (
        <Screen style={styles.container}>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
                <Text style={styles.sectionTitle}>{preset.icon} {preset.label} — challenges concernés</Text>

                {matches.length === 0 ? (
                    <Text style={styles.empty}>Aucun challenge actif de ce type dans tes groupes en ce moment.</Text>
                ) : (
                    <View style={{ gap: spacing.sm }}>
                        {matches.map((m) => {
                            const key = m.challengeId + m.groupId;
                            return (
                                <Pressable key={key} style={styles.matchRow} onPress={() => toggleMatch(key)}>
                                    <View style={[styles.checkbox, selected[key] && styles.checkboxChecked]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.matchLabel}>{m.groupName} → {m.groupementName}</Text>
                                        <Text style={styles.matchSub}>{m.challengeLabel}</Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {preset.usesGPS && (
                    <View>
                        <Text style={styles.sectionTitle}>Suivi GPS</Text>
                        <View style={styles.gpsCard}>
                            <Text style={styles.gpsValue}>{trackedDistance.toFixed(2)} km</Text>
                            {!isTracking ? (
                                <Pressable style={styles.smallButton} onPress={startTracking}><Text style={styles.buttonText}>▶ Démarrer</Text></Pressable>
                            ) : (
                                <Pressable style={[styles.smallButton, styles.buttonDanger]} onPress={stopTracking}><Text style={styles.buttonText}>⏹ Arrêter</Text></Pressable>
                            )}
                            {!isTracking && trackedDistance > 0 && (
                                <Pressable style={[styles.smallButton, styles.buttonPrimary]} onPress={() => handleSave(Number(trackedDistance.toFixed(2)))} disabled={saving}>
                                    <Text style={styles.buttonText}>Enregistrer {trackedDistance.toFixed(2)} km</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                )}

                <View>
                    <Text style={styles.sectionTitle}>Ou saisie manuelle ({preset.unit})</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numeric" value={manualValue} onChangeText={setManualValue} placeholder="Ex : 10" placeholderTextColor={colors.muted} />
                        <Pressable style={[styles.smallButton, styles.buttonPrimary]} onPress={() => handleSave(Number(manualValue))} disabled={saving}>
                            {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Enregistrer</Text>}
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    presetItem: { width: '30%', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border },
    presetIcon: { fontSize: 26, marginBottom: 4 },
    presetLabel: { color: colors.text, fontSize: 12, textAlign: 'center' },
    empty: { color: colors.muted, textAlign: 'center' },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 10, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    matchLabel: { color: colors.muted, fontSize: 11 },
    matchSub: { color: colors.text, fontSize: 14, fontWeight: '600' },
    gpsCard: { backgroundColor: colors.card, borderRadius: 14, padding: spacing.md, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
    gpsValue: { color: colors.text, fontSize: 28, fontWeight: '700' },
    input: { backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
    smallButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: spacing.md, alignItems: 'center' },
    buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    buttonDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});