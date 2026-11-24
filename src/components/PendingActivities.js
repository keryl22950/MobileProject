import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listPendingActivities, savePendingActivity, discardPendingActivity } from '../services/pendingActivities';
import { colors, spacing } from '../theme';

export default function PendingActivities({ uid }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    try {
      setItems(await listPendingActivities(uid));
    } catch {
      Alert.alert('Reprises indisponibles', 'Impossible de lire les activités conservées sur cet appareil.');
    }
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Activité conservée', error.message);
    } finally {
      await refresh();
      lock.current = false;
      setBusy(false);
    }
  }

  if (!items.length) return null;
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Activités à reprendre ({items.length})</Text>
      <Text style={{ color: colors.muted }}>Leur enregistrement n’a pas encore été confirmé.</Text>
      <ScrollView style={{ maxHeight: 180 }}>
        {items.map((item) => (
          <View key={item.activityId} style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
            <Text style={{ color: colors.text }}>
              {item.label || 'Activité'} · {item.value} {item.unit || ''} ·{' '}
              {new Date(item.date).toLocaleString('fr-FR')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <Pressable disabled={busy} onPress={() => run(() => savePendingActivity(item))}>
                <Text style={{ color: colors.primary }}>{busy ? 'Patiente…' : 'Réessayer'}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Retirer cette reprise ?',
                    'Cela retire uniquement la copie locale. Une activité déjà enregistrée sur le serveur ne sera pas annulée. Vérifie ton historique avant de la saisir à nouveau.',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Retirer',
                        style: 'destructive',
                        onPress: () => run(() => discardPendingActivity(uid, item.activityId)),
                      },
                    ]
                  )
                }
              >
                <Text style={{ color: colors.danger }}>Retirer</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
