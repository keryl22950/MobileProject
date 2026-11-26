import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { newerNativeRelease, subscribeToAppRelease } from '../services/appReleases';
import { colors, spacing } from '../theme';

export default function AppUpdateBanner() {
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  const [release, setRelease] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const enabled = !__DEV__ && Updates.isEnabled;

  useEffect(() => {
    if (!enabled) return;
    return subscribeToAppRelease(Updates.channel, Platform.OS, setRelease);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let checking = false;
    let lastCheck = 0;
    const check = async () => {
      if (checking || Date.now() - lastCheck < 60000) return;
      checking = true;
      lastCheck = Date.now();
      try {
        await Updates.checkForUpdateAsync();
      } catch {
        /* Hors ligne : l'application reste utilisable. */
      } finally {
        checking = false;
      }
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [enabled]);

  const native = newerNativeRelease(release, Updates.runtimeVersion);
  if (!enabled || (!native && !isUpdateAvailable && !isUpdatePending && !isDownloading)) return null;

  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert('Mise à jour indisponible', 'Impossible de terminer cette action. Vérifie ta connexion et réessaie.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function handlePress() {
    if (native) {
      run(() => Linking.openURL(native.installUrl));
    } else if (isUpdatePending) {
      Alert.alert(
        'Redémarrer maintenant ?',
        'Termine tes saisies et ton suivi GPS avant de redémarrer l’application.',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Redémarrer', onPress: () => run(() => Updates.reloadAsync()) },
        ]
      );
    } else {
      run(() => Updates.fetchUpdateAsync());
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.primary,
        borderWidth: 1,
        borderRadius: 12,
        padding: spacing.md,
        marginTop: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700' }}>
        {native ? `Nouvelle version ${native.version}` : 'Mise à jour disponible'}
      </Text>
      <Text style={{ color: colors.muted }}>
        {native
          ? Platform.OS === 'android'
            ? 'Cette version nécessite de télécharger un nouvel APK. Installe-le par-dessus l’application actuelle, sans la désinstaller, pour conserver ton compte.'
            : 'Cette version nécessite une nouvelle installation via le lien de distribution iPhone. Ne supprime pas l’application actuelle pour conserver ton compte.'
          : isUpdatePending
            ? 'La mise à jour est prête. Un redémarrage suffit, sans réinstallation.'
            : 'Des améliorations sont disponibles, sans réinstaller l’application.'}
      </Text>
      <Pressable accessibilityRole="button" disabled={busy || isDownloading} onPress={handlePress}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          {busy || isDownloading
            ? 'Patiente…'
            : native
              ? 'Ouvrir le lien d’installation'
              : isUpdatePending
                ? 'Redémarrer et appliquer'
                : 'Télécharger la mise à jour'}
        </Text>
      </Pressable>
    </View>
  );
}
