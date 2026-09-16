import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Share, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToGroup, subscribeToMembers } from '../services/groups';

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

  useEffect(() => {
    const unsubGroup = subscribeToGroup(groupId, setGroup);
    const unsubMembers = subscribeToMembers(groupId, setMembers);
    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [groupId]);

  if (!group) {
    return (
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
    );
  }

  function handleShare() {
    Share.share({
      message: `Rejoins mon challenge "${group.label}" sur l'app avec le code ${group.inviteCode} !`,
    });
  }

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.challengeTitle}>
            {group.icon} {group.label} — {group.target} {group.unit}
          </Text>
          <Text style={styles.timeLeft}>⏳ {formatTimeLeft(group.deadline)}</Text>
          <Text style={styles.code}>Code : {group.inviteCode}</Text>
        </View>

        <Text style={styles.sectionTitle}>Classement du groupe</Text>
        <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item, index }) => {
              const pct = Math.min(100, Math.round(((item.progress || 0) / group.target) * 100));
              const isMe = item.id === uid;
              return (
                  <View style={[styles.memberRow, isMe && styles.memberRowMe]}>
                    <Text style={styles.rank}>#{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{item.name}{isMe ? ' (toi)' : ''}</Text>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.memberValue}>
                      {(item.progress || 0).toFixed(1)}/{group.target} {group.unit}
                    </Text>
                  </View>
              );
            }}
        />

        <View style={styles.actions}>
          <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => navigation.navigate('LogActivity', { groupId })}
          >
            <Text style={styles.buttonText}>+ Enregistrer une activité</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
                style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
                onPress={() => navigation.navigate('Chat', { groupId })}
            >
              <Text style={styles.buttonText}>💬 Chat</Text>
            </Pressable>
            <Pressable
                style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
                onPress={handleShare}
            >
              <Text style={styles.buttonText}>📤 Inviter</Text>
            </Pressable>
          </View>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  challengeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  code: { color: colors.muted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRowMe: { borderColor: colors.primary },
  rank: { color: colors.muted, width: 28, fontWeight: '700' },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: colors.primary },
  memberValue: { color: colors.muted, fontSize: 12 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});