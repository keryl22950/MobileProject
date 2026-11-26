import React from 'react';
import { Switch, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function GpsBackgroundOption({ value, onChange, disabled }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }}>
      <Text style={{ flex: 1, color: colors.text }}>Continuer lorsque l’écran est verrouillé</Text>
      <Switch
        accessibilityLabel="Continuer lorsque l’écran est verrouillé"
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      />
    </View>
  );
}
