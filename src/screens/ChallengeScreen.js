import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToChallenge, subscribeToProgress } from '../services/challenges';
import Screen from '../components/Screen';

function formatTimeLeft(periodEnd) {
  if (!periodEnd) return '';
  const diffMs = periodEnd.getTime() - Date.now();
  if (diffMs <= 0) return 'Terminé';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j ${hours % 24}h restantes`;
  return `${hours}h restantes`;
}

export default function ChallengeScreen({ navigation, route }) {
  const { groupId, groupementId, challengeId, periodKey, periodEnd, readOnly } = route.params;
  const { uid } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const u1 = subscribeToChallenge(groupId, groupementId, challengeId, setChallenge);
    let u2 = () => {};
    if (periodKey) {
      u2 = subscribeToProgress(groupId, groupementId, challengeId, periodKey, setProgress);
    } else {
      setProgress([]);
    }
    return () => { u1(); u2(); };
  }, [groupId, groupementId, challengeId, periodKey]);

  if (!challenge) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const end = periodEnd ? new Date(periodEnd) : null;
  const total = progress.reduce((acc, r) => acc + (r.value || 0), 0);
  const pct = challenge.target ? Math.min(100, Math.round((total / challenge.target) * 100)) : 0;
  const remaining = Math.max(0, challenge.target - total);
  const sorted = [...progress].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.challengeTitle}>{challenge.icon} {challenge.label}</Text>
          {!readOnly && periodKey && <Text style={styles.timeLeft}>⏳ {formatTimeLeft(end)}</Text>}
        </View>

        {periodKey && (
            <View style={styles.totalCard}>
              <View style={styles.totalBarBg}><View style={[styles.totalBarFill, { width: `${pct}%` }]} /></View>
              <Text style={styles.totalText}>
                {total.toFixed(1)} / {challenge.target} {challenge.unit} — reste {remaining.toFixed(1)} {challenge.unit}
              </Text>
            </View>
        )}

        {!periodKey && !readOnly ? (
            <Text style={styles.empty}>Cet événement n'a pas encore démarré — reviens une fois qu'il aura débuté !</Text>
        ) : (
            <>
              <Text style={styles.sectionTitle}>Contributions{readOnly ? ' (historique)' : ''}</Text>
              <FlatList
                  data={sorted}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ gap: spacing.sm }}
                  ListEmptyComponent={<Text style={styles.empty}>Personne n'a encore enregistré d'activité.</Text>}
                  renderItem={({ item, index }) => {
                    const isMe = item.id === uid;
                    return (
                        <View style={[styles.memberRow, isMe && styles.memberRowMe]}>
                          <Text style={styles.rank}>#{index + 1}</Text>
                          <Text style={styles.memberName}>{item.name}{isMe ? ' (toi)' : ''}</Text>
                          <Text style={styles.memberValue}>{(item.value || 0).toFixed(1)} {challenge.unit}</Text>
                        </View>
                    );
                  }}
              />
              {!readOnly && (
                  <Pressable style={styles.button} onPress={() => navigation.navigate('LogActivity', { groupId, groupementId, challengeId, periodKey })}>
                    <Text style={styles.buttonText}>+ Enregistrer une activité</Text>
                  </Pressable>
              )}
            </>
        )}
      </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  challengeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  totalCard: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  totalBarBg: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.sm },
  totalBarFill: { height: 10, backgroundColor: colors.success, borderRadius: 5 },
  totalText: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memberRowMe: { borderColor: colors.primary },
  rank: { color: colors.muted, width: 28, fontWeight: '700' },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  memberValue: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});