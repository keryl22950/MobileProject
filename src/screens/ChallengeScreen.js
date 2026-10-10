import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToChallenge, subscribeToProgress, subscribeToActivities } from '../services/challenges';
import { subscribeToMembers } from '../services/groups';
import { subscribeToGroupement } from '../services/groupements';
import { getEffectiveTarget } from '../services/dynamicTargets';
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

function formatDate(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChallengeScreen({ navigation, route }) {
  const { groupId, groupementId, challengeId, periodKey, periodEnd, readOnly } = route.params;
  const { uid } = useAuth();

  // ⚠️ Tous les hooks (useState / useEffect) doivent rester AVANT le "return" anticipé plus bas.
  const [challenge, setChallenge] = useState(null);
  const [progress, setProgress] = useState([]);
  const [activities, setActivities] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupement, setGroupement] = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const u1 = subscribeToChallenge(groupId, groupementId, challengeId, setChallenge);
    const u2 = subscribeToMembers(groupId, setMembers);
    const u3 = subscribeToGroupement(groupId, groupementId, setGroupement);
    let u4 = () => {};
    let u5 = () => {};
    if (periodKey) {
      u4 = subscribeToProgress(groupId, groupementId, challengeId, periodKey, setProgress);
      u5 = subscribeToActivities(groupId, groupementId, challengeId, periodKey, setActivities);
    } else {
      setProgress([]);
      setActivities([]);
    }
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [groupId, groupementId, challengeId, periodKey]);

  useEffect(() => {
    if (!challenge || !groupement || !periodKey) return;
    let cancelled = false;
    getEffectiveTarget({ groupId, groupementId, groupement, challenge, periodKey })
        .then((t) => { if (!cancelled) setTarget(t); })
        .catch(() => { if (!cancelled) setTarget(challenge.target); });
    return () => { cancelled = true; };
  }, [challenge?.target, groupement?.dynamicTarget, groupement?.adaptStep, periodKey]);

  if (!challenge) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const me = members.find((m) => m.id === uid);
  const isAdmin = me?.role === 'creator' || me?.role === 'admin';
  const end = periodEnd ? new Date(periodEnd) : null;
  const effectiveTarget = target ?? challenge.target;
  const total = progress.reduce((acc, r) => acc + (r.value || 0), 0);
  const pct = effectiveTarget ? Math.min(100, Math.round((total / effectiveTarget) * 100)) : 0;
  const remaining = Math.max(0, effectiveTarget - total);
  const sorted = [...progress].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.challengeTitle}>{challenge.icon} {challenge.label}</Text>
          {!readOnly && periodKey && <Text style={styles.timeLeft}>⏳ {formatTimeLeft(end)}</Text>}
          {groupement?.dynamicTarget && <Text style={styles.timeLeft}>🎯 Objectif dynamique</Text>}
        </View>

        {!readOnly && isAdmin && (
            <View style={styles.adminRow}>
              <Pressable style={styles.smallButton} onPress={() => navigation.navigate('CreateChallenge', { groupId, groupementId, challengeId })}>
                <Text style={styles.buttonText}>✏️ Modifier</Text>
              </Pressable>
            </View>
        )}

        {periodKey && (
            <View style={styles.totalCard}>
              <View style={styles.totalBarBg}><View style={[styles.totalBarFill, { width: `${pct}%` }]} /></View>
              <Text style={styles.totalText}>
                {total.toFixed(1)} / {effectiveTarget} {challenge.unit} — reste {remaining.toFixed(1)} {challenge.unit}
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

              <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Activités récentes</Text>
              {activities.length === 0 ? (
                  <Text style={styles.empty}>Aucune activité enregistrée.</Text>
              ) : (
                  activities.map((a) => (
                      <View key={a.id} style={styles.activityRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityName}>{a.userName}</Text>
                          <Text style={styles.activityDate}>{formatDate(a.createdAt)}</Text>
                        </View>
                        <Text style={styles.activityValue}>+{a.value} {challenge.unit}</Text>
                      </View>
                  ))
              )}

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
  header: { marginBottom: spacing.sm },
  challengeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  adminRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  smallButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
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
  activityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  activityName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  activityDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  activityValue: { color: colors.primary, fontWeight: '700' },
  button: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});