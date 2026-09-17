import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { createGroup } from '../services/groups';

export default function CreateGroupScreen({ navigation }) {
  const { uid, displayName } = useAuth();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Nom manquant', 'Donne un nom à ton groupe (ex : "Famille Dupont").');
      return;
    }
    setCreating(true);
    try {
      const groupId = await createGroup({ uid, userName: displayName, name: name.trim() });
      navigation.replace('Group', { groupId });
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de créer le groupe : ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nom du groupe</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex : Famille Dupont"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <Text style={styles.hint}>
        Tu pourras inviter tes proches avec un code, et créer plusieurs challenges
        dans ce groupe au fil du temps. Tu en seras le créateur (rôle admin).
      </Text>

      <Pressable style={styles.button} onPress={handleCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Créer le groupe</Text>
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
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
});
