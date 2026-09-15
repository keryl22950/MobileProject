import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing } from '../theme';

// Calcule la distance entre 2 points GPS (formule de Haversine), en km.
function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function LogActivityScreen({ route }) {
  const [manualValue, setManualValue] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackedDistance, setTrackedDistance] = useState(0);
  const watchSubscription = useRef(null);
  const lastPoint = useRef(null);

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
        if (lastPoint.current) {
          const d = distanceKm(lastPoint.current, point);
          setTrackedDistance((prev) => prev + d);
        }
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

  function handleSaveManual() {
    // TODO: écrire un document dans Firestore "groups/{groupId}/activities"
    // avec { userId, value: Number(manualValue), createdAt, groupId }
    // puis mettre à jour la progression totale du membre dans "members".
    console.log('Sauvegarde manuelle :', manualValue, 'groupId:', route.params?.groupId);
  }

  function handleSaveTracked() {
    // TODO: idem, avec value = trackedDistance (arrondi), + éventuellement
    // le tracé GPS complet si on veut l'afficher dans ActivityDetailScreen.
    console.log('Sauvegarde GPS :', trackedDistance.toFixed(2), 'km');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Suivi GPS (course à pied, vélo...)</Text>
      <View style={styles.gpsCard}>
        <Text style={styles.gpsValue}>{trackedDistance.toFixed(2)} km</Text>
        {!isTracking ? (
          <Pressable style={styles.button} onPress={startTracking}>
            <Text style={styles.buttonText}>▶ Démarrer le suivi</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.buttonDanger]} onPress={stopTracking}>
            <Text style={styles.buttonText}>⏹ Arrêter</Text>
          </Pressable>
        )}
        {!isTracking && trackedDistance > 0 && (
          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSaveTracked}>
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
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSaveManual}>
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
