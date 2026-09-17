import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToChallenge, subscribeToProgress } from '../services/challenges';

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
    const u2 = subscribeToProgress(groupId, groupementId, challengeId, periodKey, setProgress);
    return () => { u1(); u2(); };
  }, [groupId, groupementId, challengeId, periodKey]);

  if (!challenge) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const end = periodEnd ? new Date(periodEnd) : null;

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.challengeTitle}>{challenge.icon} {challenge.label} — {challenge.target} {challenge.unit}</Text>
          {!readOnly && <Text style={styles.timeLeft}>⏳ {formatTimeLeft(end)}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Classement{readOnly ? ' (historique)' : ''}</Text>
        <FlatList
            data={progress}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            ListEmptyComponent={<Text style={styles.empty}>Personne n'a encore enregistré d'activité.</Text>}
            renderItem={({ item, index }) => {
              const pct = Math.min(100, Math.round(((item.value || 0) / challenge.target) * 100));
              const isMe = item.id === uid;
              return (
                  <View style={[styles.memberRow, isMe && styles.memberRowMe]}>
                    <Text style={styles.rank}>#{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{item.name}{isMe ? ' (toi)' : ''}</Text>
                      <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${pct}%` }]} /></View>
                    </View>
                    <Text style={styles.memberValue}>{(item.value || 0).toFixed(1)}/{challenge.target} {challenge.unit}</Text>
                  </View>
              );
            }}
        />

        {!readOnly && (
            <Pressable style={styles.button} onPress={() => navigation.navigate('LogActivity', { groupId, groupementId, challengeId, periodKey })}>
              <Text style={styles.buttonText}>+ Enregistrer une activité</Text>
            </Pressable>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  challengeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 }, 
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memberRowMe: { borderColor: colors.primary },
  rank: { color: colors.muted, width: 28, fontWeight: '700' },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: colors.primary },
  memberValue: { color: colors.muted, fontSize: 12 },
  button: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});