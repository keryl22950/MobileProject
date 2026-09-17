import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Share, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToGroup, subscribeToMembers } from '../services/groups';
import { subscribeToChallenges } from '../services/challenges';

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

export default function GroupScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { uid } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    const unsubGroup = subscribeToGroup(groupId, setGroup);
    const unsubMembers = subscribeToMembers(groupId, setMembers);
    const unsubChallenges = subscribeToChallenges(groupId, setChallenges);
    return () => {
      unsubGroup();
      unsubMembers();
      unsubChallenges();
    };
  }, [groupId]);

  if (!group) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const me = members.find((m) => m.id === uid);
  const isAdmin = me?.role === 'creator' || me?.role === 'admin';

  function handleShare() {
    Share.share({
      message: `Rejoins mon groupe "${group.name}" sur l'app avec le code ${group.inviteCode} !`,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.groupTitle}>👥 {group.name}</Text>
        <Text style={styles.code}>Code : {group.inviteCode} · {members.length} membres</Text>
      </View>

      <View style={styles.topActions}>
        <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Members', { groupId })}>
          <Text style={styles.buttonText}>👤 Membres</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Chat', { groupId })}>
          <Text style={styles.buttonText}>💬 Chat</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={handleShare}>
          <Text style={styles.buttonText}>📤 Inviter</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Challenges du groupe</Text>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun challenge pour l'instant.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.challengeCard}
            onPress={() => navigation.navigate('Challenge', { groupId, challengeId: item.id })}
          >
            <Text style={styles.challengeIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeLabel}>{item.label}</Text>
              <Text style={styles.challengeSub}>Objectif : {item.target} {item.unit}</Text>
            </View>
            <Text style={styles.challengeTime}>{formatTimeLeft(item.deadline)}</Text>
          </Pressable>
        )}
      />

      {isAdmin && (
        <Pressable
          style={[styles.button, styles.buttonPrimary, { marginTop: spacing.md }]}
          onPress={() => navigation.navigate('CreateChallenge', { groupId })}
        >
          <Text style={styles.buttonText}>+ Nouveau challenge</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  groupTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  code: { color: colors.muted, fontSize: 12, marginTop: 4 },
  topActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeIcon: { fontSize: 26 },
  challengeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  challengeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  challengeTime: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },
});
