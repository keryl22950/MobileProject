import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { auth } from '../services/firebase';
import {
  accountErrorMessage,
  linkAnonymousAccount,
  recoverAccount,
  requestPasswordReset,
  sendAccountVerification,
  signOutOfAccount,
} from '../services/accounts';
import { colors, spacing } from '../theme';

export default function AccountScreen({ recover = false, onCancel }) {
  const [accountEmail, setAccountEmail] = useState(auth.currentUser?.email);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Compte', accountErrorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {accountEmail ? (
        <>
          <Text style={styles.text}>Compte associé à {accountEmail}.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.button}
            onPress={() =>
              run(async () => {
                await sendAccountVerification();
                Alert.alert('E-mail envoyé', 'Ouvre le lien reçu pour confirmer ton adresse.');
              })
            }
          >
            <Text style={styles.buttonText}>Envoyer un e-mail de vérification</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              Alert.alert('Se déconnecter ?', 'Tu pourras te reconnecter avec ton adresse e-mail.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Se déconnecter', onPress: () => run(signOutOfAccount) },
              ])
            }
          >
            <Text style={styles.link}>Se déconnecter</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {recover
              ? 'Connecte-toi pour retrouver tes groupes et tes activités.'
              : 'Associe une adresse e-mail pour retrouver ce compte et ses activités sur un autre téléphone.'}
          </Text>
          <TextInput
            accessibilityLabel="Adresse e-mail"
            style={styles.input}
            placeholder="Adresse e-mail"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            accessibilityLabel="Mot de passe"
            style={styles.input}
            placeholder={recover ? 'Mot de passe' : 'Mot de passe (8 caractères minimum)'}
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            secureTextEntry
            autoComplete={recover ? 'current-password' : 'new-password'}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            disabled={busy}
            onPress={() =>
              run(async () => {
                if (recover) {
                  await recoverAccount(email, password);
                } else {
                  const linked = await linkAnonymousAccount(email, password);
                  setAccountEmail(linked.email);
                  Alert.alert('Compte associé', 'Tes groupes et ton historique sont conservés.');
                }
                setPassword('');
              })
            }
          >
            <Text style={styles.buttonText}>
              {busy ? 'Patiente…' : recover ? 'Se connecter' : 'Associer cette adresse'}
            </Text>
          </Pressable>
          {recover && (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await requestPasswordReset(email);
                    Alert.alert(
                      'Réinitialisation',
                      'Si cette adresse est associée à un compte, tu recevras un lien de réinitialisation.'
                    );
                  })
                }
              >
                <Text style={styles.link}>Mot de passe oublié</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}>
                <Text style={styles.link}>Retour</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  text: { color: colors.text, lineHeight: 21 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
  },
  button: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.primaryText, fontWeight: '700' },
  link: { color: colors.primary, fontWeight: '700', paddingVertical: spacing.sm },
});
