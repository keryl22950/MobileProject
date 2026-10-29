import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { createGroup, updateGroup, subscribeToGroup } from '../services/groups';

export default function CreateGroupScreen({ navigation, route }) {
  // Si un groupId est passé, on est en mode édition ; sinon, en mode création.
  const groupId = route.params?.groupId;
  const isEditing = !!groupId;
  const { uid, displayName } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Modifier le groupe' : 'Créer un groupe' });
  }, [isEditing, navigation]);

  useEffect(() => {
    if (!isEditing) return;
    const unsubscribe = subscribeToGroup(groupId, (g) => {
      setName(g.name);
      setLoaded(true);
    });
    return unsubscribe;
  }, [isEditing, groupId]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Nom manquant', 'Donne un nom à ton groupe (ex : "Famille Dupont").');
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await updateGroup({ groupId, changes: { name: name.trim() } });
        navigation.goBack();
      } else {
        const newGroupId = await createGroup({ uid, userName: displayName, name: name.trim() });
        navigation.replace('Group', { groupId: newGroupId });
      }
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'enregistrer le groupe : " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
    );
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
        {!isEditing && (
            <Text style={styles.hint}>
              Tu pourras inviter tes proches avec un code, et créer plusieurs événements dans ce groupe au fil du temps.
              Tu en seras le créateur (rôle admin).
            </Text>
        )}
        <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
          {saving ? (
              <ActivityIndicator color={colors.primaryText} />
          ) : (
              <Text style={styles.buttonText}>{isEditing ? 'Enregistrer' : 'Créer le groupe'}</Text>
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