import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { CHALLENGE_PRESETS } from '../data/presets';
import GpsBackgroundOption from '../components/GpsBackgroundOption';
import RouteMap from '../components/RouteMap';
import { useForegroundGps } from '../hooks/useForegroundGps';
import { useAuth } from '../context/AuthContext';
import { findActiveChallengesForPreset } from '../services/quickLog';
import Screen from '../components/Screen';
import { createActivityId } from '../services/activities';
import { savePendingActivity } from '../services/pendingActivities';

const QUICK_PRESETS = CHALLENGE_PRESETS.filter((p) => p.id !== 'custom');

export default function QuickLogScreen({ navigation }) {
  const { uid, displayName } = useAuth();
  const [preset, setPreset] = useState(null);
  const [matches, setMatches] = useState(null);
  const [selected, setSelected] = useState({});
  const [searching, setSearching] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const { isTracking, starting, trackedDistance, routePoints, startTracking, stopTracking } = useForegroundGps();
  const [backgroundGps, setBackgroundGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const submission = useRef(null);
  const saveLock = useRef(false);

  async function handleSelectPreset(p) {
    setPreset(p);
    setSearching(true);
    try {
      const found = await findActiveChallengesForPreset({ uid, presetId: p.id });
      setMatches(found);
      setSelected(Object.fromEntries(found.map((m) => [m.challengeId + m.groupId, true])));
    } catch (err) {
      setPreset(null);
      Alert.alert('Erreur', err.message);
    } finally {
      setSearching(false);
    }
  }

  function toggleMatch(key) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave(value) {
    if (saveLock.current) return;
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Valeur invalide', 'Indique une valeur supérieure à 0.');
      return;
    }
    const targets = (matches || []).filter((m) => selected[m.challengeId + m.groupId]);

    saveLock.current = true;
    setSaving(true);
    try {
      if (!submission.current) submission.current = createActivityId(uid);
      await savePendingActivity({
        uid,
        userName: displayName,
        activityId: submission.current,
        presetId: preset.id,
        label: preset.label,
        icon: preset.icon,
        unit: preset.unit,
        value,
        targets,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      saveLock.current = false;
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
    return (
      <Screen style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        <Text style={styles.sectionTitle}>
          {preset.icon} {preset.label} — challenges concernés
        </Text>

        {matches.length === 0 ? (
          <Text style={styles.empty}>
            Aucun challenge actif de ce type dans tes groupes pour l'instant — l'activité sera quand même ajoutée à ton
            profil.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {matches.map((m) => {
              const key = m.challengeId + m.groupId;
              return (
                <Pressable key={key} style={styles.matchRow} onPress={() => toggleMatch(key)}>
                  <View style={[styles.checkbox, selected[key] && styles.checkboxChecked]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchLabel}>
                      {m.groupName} → {m.groupementName}
                    </Text>
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
              <GpsBackgroundOption
                value={backgroundGps}
                onChange={setBackgroundGps}
                disabled={starting || isTracking}
              />
              <Text style={styles.gpsValue}>{trackedDistance.toFixed(2)} km</Text>
              {!isTracking ? (
                <Pressable style={styles.smallButton} onPress={() => startTracking(backgroundGps)} disabled={starting}>
                  <Text style={styles.buttonText}>▶ Démarrer</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.smallButton, styles.buttonDanger]} onPress={stopTracking}>
                  <Text style={styles.buttonText}>⏹ Arrêter</Text>
                </Pressable>
              )}
              {!starting && !isTracking && <RouteMap points={routePoints} />}
              {!starting && !isTracking && trackedDistance > 0 && (
                <Pressable
                  style={[styles.smallButton, styles.buttonPrimary]}
                  onPress={() => handleSave(Number(trackedDistance.toFixed(2)))}
                  disabled={saving}
                >
                  <Text style={styles.buttonText}>Enregistrer {trackedDistance.toFixed(2)} km</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View>
          <Text style={styles.sectionTitle}>Ou saisie manuelle ({preset.unit})</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              keyboardType="numeric"
              value={manualValue}
              onChangeText={setManualValue}
              placeholder="Ex : 10"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={[styles.smallButton, styles.buttonPrimary]}
              onPress={() => handleSave(Number(manualValue))}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.buttonText}>Enregistrer</Text>
              )}
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
  presetItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetIcon: { fontSize: 26, marginBottom: 4 },
  presetLabel: { color: colors.text, fontSize: 12, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center' },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  matchLabel: { color: colors.muted, fontSize: 11 },
  matchSub: { color: colors.text, fontSize: 14, fontWeight: '600' },
  gpsCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsValue: { color: colors.text, fontSize: 28, fontWeight: '700' },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});
