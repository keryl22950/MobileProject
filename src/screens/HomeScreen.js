import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing } from '../theme';

// TODO: remplacer par les vrais groupes de l'utilisateur, récupérés depuis
// Firestore (collection "groups" où l'utilisateur courant est membre).
const MOCK_GROUPS = [
  {
    id: '1',
    challengeLabel: 'Course à pied',
    icon: '🏃',
    target: 50,
    unit: 'km',
    membersCount: 4,
    timeLeft: '8h restantes',
  },
  {
    id: '2',
    challengeLabel: 'Pompes',
    icon: '💪',
    target: 500,
    unit: 'reps',
    membersCount: 3,
    timeLeft: '1j 4h restantes',
  },
];

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes challenges en cours</Text>

      <FlatList
        data={MOCK_GROUPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Tu ne participes à aucun challenge pour l'instant.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('Group', { groupId: item.id })}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.challengeLabel}</Text>
              <Text style={styles.cardSubtitle}>
                Objectif : {item.target} {item.unit} · {item.membersCount} membres
              </Text>
              <Text style={styles.cardTime}>{item.timeLeft}</Text>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => navigation.navigate('CreateChallenge')}
        >
          <Text style={styles.buttonText}>+ Créer un challenge</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.navigate('JoinGroup')}
        >
          <Text style={styles.buttonText}>Rejoindre avec un code</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: { fontSize: 32 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  cardTime: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 15 },
});
