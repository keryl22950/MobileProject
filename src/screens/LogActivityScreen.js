import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import GpsBackgroundOption from '../components/GpsBackgroundOption';
import RouteMap from '../components/RouteMap';
import { useForegroundGps } from '../hooks/useForegroundGps';
import { useAuth } from '../context/AuthContext';
import { createActivityId } from '../services/activities';
import { savePendingActivity } from '../services/pendingActivities';

export default function LogActivityScreen({ route, navigation }) {
  const { groupId, groupementId, challengeId, periodKey } = route.params;
  const { uid, displayName } = useAuth();
  const [manualValue, setManualValue] = useState('');
  const { isTracking, starting, trackedDistance, routePoints, startTracking, stopTracking } = useForegroundGps();
  const [backgroundGps, setBackgroundGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const submission = useRef(null);
  const saveLock = useRef(false);

  async function saveValue(value) {
    if (saveLock.current) return;
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Valeur invalide', 'Indique une valeur supérieure à 0.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      if (!submission.current) submission.current = createActivityId(uid);
      await savePendingActivity({
        uid,
        userName: displayName,
        activityId: submission.current,
        value,
        targets: [{ groupId, groupementId, challengeId, periodKey }],
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'enregistrer l'activité : " + err.message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function handleSaveManual() {
    saveValue(Number(manualValue));
  }

  function handleSaveTracked() {
    saveValue(Number(trackedDistance.toFixed(2)));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Suivi GPS (course à pied, vélo...)</Text>
      <View style={styles.gpsCard}>
        <GpsBackgroundOption value={backgroundGps} onChange={setBackgroundGps} disabled={starting || isTracking} />
        <Text style={styles.gpsValue}>{trackedDistance.toFixed(2)} km</Text>
        {!isTracking ? (
          <Pressable style={styles.button} onPress={() => startTracking(backgroundGps)} disabled={starting}>
            <Text style={styles.buttonText}>▶ Démarrer le suivi</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.buttonDanger]} onPress={stopTracking}>
            <Text style={styles.buttonText}>⏹ Arrêter</Text>
          </Pressable>
        )}
        {!starting && !isTracking && <RouteMap points={routePoints} />}
        {!starting && !isTracking && trackedDistance > 0 && (
          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSaveTracked} disabled={saving}>
            <Text style={styles.buttonText}>Enregistrer {trackedDistance.toFixed(2)} km</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Ou saisie manuelle</Text>
      <View style={styles.manualCard}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Ex : 12"
          placeholderTextColor={colors.muted}
          value={manualValue}
          onChangeText={setManualValue}
        />
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSaveManual} disabled={saving}>
          <Text style={styles.buttonText}>Enregistrer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.lg },
  sectionTitle: { color: colors.muted, fontSize: 13, textTransform: 'uppercase' },
  gpsCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsValue: { color: colors.text, fontSize: 32, fontWeight: '700' },
  manualCard: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
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
