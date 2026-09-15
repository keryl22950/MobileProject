import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing } from '../theme';

export default function JoinGroupScreen({ navigation }) {
  const [code, setCode] = useState('');

  function handleJoin() {
    // TODO: chercher dans Firestore le groupe dont le champ "inviteCode"
    // correspond à `code`, y ajouter l'utilisateur courant comme membre,
    // puis naviguer vers l'écran du groupe.
    if (!code.trim()) return;
    navigation.replace('Group', { groupId: 'groupe-trouve-via-' + code });
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
        Demande le code (ou le lien) à la personne qui a créé le challenge.
      </Text>

      <Pressable style={styles.button} onPress={handleJoin}>
        <Text style={styles.buttonText}>Rejoindre</Text>
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
