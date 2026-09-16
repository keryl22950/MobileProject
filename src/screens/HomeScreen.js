import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToMyGroups } from '../services/groups';

function formatTimeLeft(deadline) {
  if (!deadline) return '';
  const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
  const diffMs = deadlineDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Terminé';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j ${hours % 24}h restantes`;
  return `${hours}h restantes`;
}

export default function HomeScreen({ navigation }) {
  const { uid } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToMyGroups(uid, (data) => {
      setGroups(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return (
      <View style={styles.container}>
        <Text style={styles.title}>Mes challenges en cours</Text>

        <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.md }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {loading ? 'Chargement...' : "Tu ne participes à aucun challenge pour l'instant."}
              </Text>
            }
            renderItem={({ item }) => (
                <Pressable
                    style={styles.card}
                    onPress={() => navigation.navigate('Group', { groupId: item.id })}
                >
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    <Text style={styles.cardSubtitle}>
                      Objectif : {item.target} {item.unit} · {(item.memberIds || []).length} membres
                    </Text>
                    <Text style={styles.cardTime}>{formatTimeLeft(item.deadline)}</Text>
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