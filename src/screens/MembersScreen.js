import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToMembers, updateMemberRole, roleLabel } from '../services/groups';

export default function MembersScreen({ route }) {
  const { groupId } = route.params;
  const { uid } = useAuth();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToMembers(groupId, setMembers);
    return unsubscribe;
  }, [groupId]);

  const me = members.find((m) => m.id === uid);
  const isAdmin = me?.role === 'creator' || me?.role === 'admin';

  function handleChangeRole(member) {
    if (member.role === 'creator') {
      Alert.alert('Impossible', 'Le créateur du groupe ne peut pas changer de rôle.');
      return;
    }
    const nextRole = member.role === 'admin' ? 'participant' : 'admin';
    Alert.alert(
      `${nextRole === 'admin' ? 'Promouvoir' : 'Rétrograder'} ${member.name}`,
      nextRole === 'admin'
        ? `${member.name} pourra créer et modifier des challenges.`
        : `${member.name} redeviendra simple participant.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => updateMemberRole({ groupId, memberId: member.id, role: nextRole }),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          const canManage = isAdmin && item.id !== uid && item.role !== 'creator';
          return (
            <Pressable
              style={styles.row}
              disabled={!canManage}
              onPress={() => handleChangeRole(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.name}
                  {item.id === uid ? ' (toi)' : ''}
                </Text>
              </View>
              <View style={[styles.badge, item.role === 'creator' && styles.badgeCreator]}>
                <Text style={styles.badgeText}>{roleLabel(item.role)}</Text>
              </View>
              {canManage && <Text style={styles.chevron}>›</Text>}
            </Pressable>
          );
        }}
      />
      {isAdmin && (
        <Text style={styles.hint}>
          Appuie sur un membre pour le promouvoir admin ou le rétrograder participant.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  badge: {
    backgroundColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeCreator: { backgroundColor: colors.primary },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 18 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
