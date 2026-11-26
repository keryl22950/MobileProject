import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing } from '../theme';
import { subscribeToChallenges, subscribeToCumulative } from '../services/challenges';

export default function StatsScreen({ route }) {
  const { groupId, groupementId } = route.params;
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToChallenges(groupId, groupementId, setChallenges);
    return unsubscribe;
  }, [groupId, groupementId]);

  return (
    <FlatList
      style={styles.container}
      data={challenges}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      ListEmptyComponent={<Text style={styles.empty}>Pas encore de challenge dans ce groupement.</Text>}
      renderItem={({ item }) => <ChallengeTotals groupId={groupId} groupementId={groupementId} challenge={item} />}
    />
  );
}

function ChallengeTotals({ groupId, groupementId, challenge }) {
  const [totals, setTotals] = useState([]);
  useEffect(
    () => subscribeToCumulative(groupId, groupementId, challenge.id, setTotals),
    [groupId, groupementId, challenge.id]
  );
  return (
    <View>
      <Text style={styles.title}>
        {challenge.icon} {challenge.label} — cumul total
      </Text>
      {totals.length === 0 ? (
        <Text style={styles.empty}>Aucune activité enregistrée encore.</Text>
      ) : (
        totals.map((member, index) => (
          <View key={member.id} style={styles.row}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={styles.name}>{member.name}</Text>
            <Text style={styles.value}>
              {(member.value || 0).toFixed(1)} {challenge.unit}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  rank: { color: colors.muted, width: 28, fontWeight: '700' },
  name: { color: colors.text, flex: 1, fontWeight: '600' },
  value: { color: colors.primary, fontWeight: '700' },
});
