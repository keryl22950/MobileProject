import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function FeedMore({ hasMore, loading, error, loadOlder, label = 'Afficher les activités précédentes' }) {
  if (!hasMore && !error) return null;
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      {!!error && <Text style={{ color: colors.muted, textAlign: 'center' }}>{error}</Text>}
      {hasMore && (
        <Pressable accessibilityRole="button" disabled={loading} onPress={loadOlder}>
          <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>
            {loading ? 'Chargement…' : label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
