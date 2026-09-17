import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { CHALLENGE_PRESETS, DURATION_PRESETS } from '../data/presets';
import { useAuth } from '../context/AuthContext';
import { createChallenge } from '../services/challenges';

export default function CreateChallengeScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { uid } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState(CHALLENGE_PRESETS[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_PRESETS[1]); // 24h par défaut
  const [target, setTarget] = useState(String(CHALLENGE_PRESETS[0].defaultTarget));
  const [customName, setCustomName] = useState('');
  const [creating, setCreating] = useState(false);

  const isCustom = selectedPreset.id === 'custom';

  function handleSelectPreset(preset) {
    setSelectedPreset(preset);
    setTarget(String(preset.defaultTarget));
  }

  async function handleCreate() {
    const numericTarget = Number(target);
    if (!numericTarget || numericTarget <= 0) {
      Alert.alert('Objectif invalide', 'Indique un objectif numérique supérieur à 0.');
      return;
    }
    if (isCustom && !customName.trim()) {
      Alert.alert('Nom manquant', 'Donne un nom à ton challenge personnalisé.');
      return;
    }
    if (!selectedDuration.hours) {
      Alert.alert('Durée manquante', 'Choisis une durée pour le challenge.');
      return;
    }

    setCreating(true);
    try {
      const challengeId = await createChallenge({
        groupId,
        createdBy: uid,
        presetId: selectedPreset.id,
        label: isCustom ? customName.trim() : selectedPreset.label,
        icon: selectedPreset.icon,
        unit: selectedPreset.unit,
        target: numericTarget,
        durationHours: selectedDuration.hours,
      });
      navigation.replace('Challenge', { groupId, challengeId });
    } catch (err) {
      Alert.alert('Erreur', "Impossible de créer le challenge : " + err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <View>
        <Text style={styles.sectionTitle}>Type de challenge</Text>
        <View style={styles.grid}>
          {CHALLENGE_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => handleSelectPreset(preset)}
              style={[
                styles.presetItem,
                selectedPreset.id === preset.id && styles.presetItemSelected,
              ]}
            >
              <Text style={styles.presetIcon}>{preset.icon}</Text>
              <Text style={styles.presetLabel}>{preset.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isCustom && (
        <View>
          <Text style={styles.sectionTitle}>Nom du challenge</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Nombre de pages de BD lues"
            placeholderTextColor={colors.muted}
            value={customName}
            onChangeText={setCustomName}
          />
        </View>
      )}

      <View>
        <Text style={styles.sectionTitle}>Objectif ({selectedPreset.unit})</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={target}
          onChangeText={setTarget}
        />
      </View>

      <View>
        <Text style={styles.sectionTitle}>Durée du challenge</Text>
        <View style={styles.row}>
          {DURATION_PRESETS.map((d) => (
            <Pressable
              key={d.label}
              onPress={() => setSelectedDuration(d)}
              style={[
                styles.chip,
                selectedDuration.label === d.label && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipText}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.createButtonText}>Créer le challenge</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetItemSelected: { borderColor: colors.primary, backgroundColor: '#1c1f3a' },
  presetIcon: { fontSize: 26, marginBottom: 4 },
  presetLabel: { color: colors.text, fontSize: 12, textAlign: 'center' },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#1c1f3a' },
  chipText: { color: colors.text, fontSize: 13 },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  createButtonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
});
