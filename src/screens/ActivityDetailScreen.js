import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

// TODO: récupérer les vraies données de l'activité depuis Firestore
// via route.params.activityId, y compris le tracé GPS (liste de points)
// si on veut l'afficher sur une carte (ex. avec react-native-maps).
export default function ActivityDetailScreen({ route }) {
  const activity = {
    author: 'Léa',
    type: 'Course à pied',
    icon: '🏃',
    value: 8.4,
    unit: 'km',
    duration: '42 min',
    pace: "5'00/km",
    date: 'Aujourd\u2019hui à 07h32',
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>{activity.icon}</Text>
        <View>
          <Text style={styles.title}>{activity.type}</Text>
          <Text style={styles.subtitle}>
            {activity.author} · {activity.date}
          </Text>
        </View>
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>
          📍 Carte du parcours (à intégrer avec react-native-maps)
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{activity.value} {activity.unit}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{activity.duration}</Text>
          <Text style={styles.statLabel}>Durée</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{activity.pace}</Text>
          <Text style={styles.statLabel}>Allure</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 32 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12 },
  mapPlaceholder: {
    height: 180,
    backgroundColor: colors.card,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapPlaceholderText: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
