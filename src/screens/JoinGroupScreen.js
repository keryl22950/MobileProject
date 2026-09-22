import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { joinGroupByCode } from '../services/groups';

export default function JoinGroupScreen({ navigation, route }) {
  const { uid, displayName } = useAuth();
  const [code, setCode] = useState(route.params?.code ?? '');
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;
    setJoining(true);
    try {
      const groupId = await joinGroupByCode({ uid, userName: displayName, code });
      navigation.replace('Group', { groupId });
    } catch (err) {
      Alert.alert('Impossible de rejoindre', err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Code d'invitation</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex : ABC123"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />
      <Text style={styles.hint}>
        Demande le code (ou le lien) à la personne qui a créé le groupe.
      </Text>

      <Pressable style={styles.button} onPress={handleJoin} disabled={joining}>
        {joining ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Rejoindre</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 18,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.muted, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
});
